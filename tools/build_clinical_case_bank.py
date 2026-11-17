import re, json, sys, unicodedata
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "clinical-case-source"
OUT = ROOT / "for Chrome" / "data" / "clinicalCaseBank.json"
SYSTEMS = [
 ("CNS Clinical Cases.md","central-nervous-system","Central Nervous System"),
 ("CVS Clinical Cases.md","cardiovascular-system","Cardiovascular System"),
 ("Endocrinology Clinical Cases.md","endocrine-system","Endocrine System"),
 ("GIT Clinical Cases.md","gastrointestinal-system","Gastrointestinal System"),
 ("Hematology Clinical Cases.md","hematology","Hematology"),
 ("Infectious Clinical Cases.md","infectious-diseases","Infectious Diseases"),
 ("Neonatology Clinical Cases.md","neonatology","Neonatology"),
 ("Nephrology Clinical Cases.md","nephrology","Nephrology"),
 ("Pediatric Vaccination Clinical Cases.md","pediatric-vaccination","Pediatric Vaccination"),
 ("Respiratory Clinical Cases.md","respiratory-system","Respiratory System"),
]
Q_RE = re.compile(r"(?m)^###\s*Q\s*(\d+)\s*[.)]?\s*(.*)$")
TOPIC_RE = re.compile(r"^#\s+(\d+)\.\s+(.+?)\s*$")
CASE_RE = re.compile(r"^#{1,3}\s*Clinical\s+Case\s*(?:(\d+)\s*)?[-–—:?\uFFFD]*\s*(.*)$", re.I)
CORRECT_RE = re.compile(r"(?im)^\*\*Correct Answer:\*\*\s*([A-E])(?:\.\s*(.*?))?\s*$")
OPTION_RE = re.compile(r"(?m)^([A-E])\.\s*(.*?)\s*$")
RATIONALE_RE = re.compile(r"(?im)^\s*-\s+\*\*([A-E](?:\s*(?:,|and)\s*[A-E])*)\.\s*.*?\b(Correct|Incorrect|Included)(?:\s*\([^)]*\))?\.\*\*")
PAGE_RE = re.compile(r"\bPages?\s+([^.;]+)", re.I)

def clean(s):
    return s.replace("\r\n","\n").replace("\r","\n").strip()

def norm(s):
    return re.sub(r"\s+"," ",unicodedata.normalize("NFKC",s or "")).strip().casefold()

def slug(s):
    s=re.sub(r"[^a-z0-9]+","-",s.lower()).strip("-")
    return s or "topic"

def section(text, start_label, end_label=None):
    m=re.search(re.escape(start_label),text,re.I)
    if not m: return ""
    a=m.end()
    if end_label:
        n=re.search(re.escape(end_label),text[a:],re.I)
        if n: return clean(text[a:a+n.start()])
    return clean(text[a:])

def parse_system(filename, sysid, sysname):
    path=SRC/filename
    raw=path.read_text(encoding="utf-8-sig")
    lines=raw.replace("\r\n","\n").replace("\r","\n").split("\n")
    qmatches=list(Q_RE.finditer(raw))
    topics_by_key={}
    cases_by_key={}
    # Collect heading locations and their text, retaining the original order.
    headings=[]
    for i,line in enumerate(lines):
        tm=TOPIC_RE.match(line.strip())
        if tm:
            headings.append(("topic",i,tm.group(1),tm.group(2).strip()))
            continue
        cm=CASE_RE.match(line.strip())
        if cm:
            headings.append(("case",i,cm.group(1) or "",cm.group(2).strip(" \t-–—:?")))
    for qi,m in enumerate(qmatches):
        line_no=raw[:m.start()].count("\n")
        q_end=qmatches[qi+1].start() if qi+1<len(qmatches) else len(raw)
        # Do not let a trailing next topic/case section leak into the question record.
        next_heading=re.search(r"(?m)^#{1,2}\s+(?!Q\s*\d)",raw[m.end():q_end])
        if next_heading: q_end=min(q_end,m.end()+next_heading.start())
        block=clean(raw[m.start():q_end])
        header=m.group(2).strip()
        # Difficulty is explicitly supplied in square brackets on most source questions.
        dm=re.match(r"\[(Easy|Moderate|Medium|Hard)\]\s*(.*)$",header,re.I)
        difficulty=("Moderate" if dm.group(1).lower()=="medium" else dm.group(1).title()) if dm else "Unspecified"
        stem=dm.group(2).strip() if dm else header
        # Track the most recent topic and case headings before this question.
        before=[h for h in headings if h[1] < line_no]
        topic_h=next((h for h in reversed(before) if h[0]=="topic"),None)
        case_h=next((h for h in reversed(before) if h[0]=="case"),None)
        if topic_h:
            topic_name=topic_h[3]
            topic_ord=topic_h[2]
            topic_key=f"{sysid}-topic-intro" if int(topic_ord)==0 else f"{sysid}-topic-{int(topic_ord):02d}"
        else:
            topic_name="Introductory / Unsectioned Questions"
            topic_ord="0"
            topic_key=f"{sysid}-topic-intro"
        if case_h and (not topic_h or case_h[1] > topic_h[1]):
            case_line=case_h[1]
            case_no=case_h[2] or str(sum(1 for h in before if h[0]=="case"))
            case_title=case_h[3] or f"Clinical Case {case_no}"
            case_key=f"{sysid}-case-{int(case_no):02d}" if case_no.isdigit() else f"{sysid}-case-{slug(case_title)}"
            # Shared narrative is only text after case heading up to the next markdown heading/question.
            case_start=case_line+1
            case_end=len(lines)
            for jj in range(case_start,len(lines)):
                if lines[jj].lstrip().startswith("#"):
                    case_end=jj; break
            vignette=clean("\n".join(lines[case_start:case_end]))
            is_explicit=True
        else:
            case_no="0"
            case_title="Topic Questions (No Shared Case Text in Source)"
            case_key=f"{sysid}-{topic_key}-topic-questions"
            vignette=""
            is_explicit=False
        # The first source heading may not exist; use a transparent, non-invented group.
        if case_key not in cases_by_key:
            cases_by_key[case_key]={
                "id":case_key, "number":int(case_no) if str(case_no).isdigit() else None,
                "title":case_title, "vignette":vignette, "hasSharedCaseText":bool(vignette),
                "sourceHeadingPresent":is_explicit, "questions":[]
            }
        # Extract options and key.
        cm=CORRECT_RE.search(block)
        answer=cm.group(1).upper() if cm else ""
        answer_text=clean(cm.group(2) or "") if cm else ""
        if not answer_text and answer in "ABCDE":
            answer_text=next((o["text"] for o in options if o["label"]==answer),"")
        pre=block[:cm.start()] if cm else block
        options=sorted([{"label":x.group(1),"text":clean(x.group(2))} for x in OPTION_RE.finditer(pre)], key=lambda x:x["label"])
        # Sections are delimited by the next named section.
        initial=section(block,"**Initial Explanation:**","**Detailed Explanation:**")
        detailed=section(block,"**Detailed Explanation:**","**HIGH-YIELD POINTS:**")
        highyield=section(block,"**HIGH-YIELD POINTS:**","**Source:**")
        sm=re.search(r"(?m)^\*\*Source:\*\*\s*(.+?)\s*$",block)
        source_raw=clean(sm.group(1)) if sm else ""
        # Repair common UTF-8-as-Windows-1252 dash corruption in source citations.
        source_raw=source_raw.replace(chr(0x00e2)+chr(0x20ac)+chr(0x201d),chr(0x2014)).replace(chr(0x00e2)+chr(0x20ac)+chr(0x201c),chr(0x2013))
        pm=PAGE_RE.search(source_raw)
        pages=clean(pm.group(1)) if pm else ""
        sheet=clean(source_raw[:pm.start()]).rstrip(" -–—:") if pm else source_raw
        rationale_matches=list(RATIONALE_RE.finditer(detailed))
        rationales=Counter(letter for match in rationale_matches for letter in re.findall(r"\b[A-E]\b",match.group(1).upper()))
        correct_markers=[letter for match in rationale_matches if match.group(2).lower()=="correct" for letter in re.findall(r"\b[A-E]\b",match.group(1).upper())]
        errors=[]
        warnings=[]
        labels=[o["label"] for o in options]
        if len(options)!=5 or set(labels) != set("ABCDE") or len(set(labels)) != 5: errors.append("options")
        if answer not in "ABCDE": errors.append("answer-key")
        if answer_text and options and answer in "ABCDE" and norm(answer_text)!=norm(next((o["text"] for o in options if o["label"]==answer),"")):
            warnings.append("answer-key-text-differs-from-option-text")
        if not initial: errors.append("initial-explanation")
        if not detailed: errors.append("detailed-explanation")
        if not highyield: errors.append("high-yield")
        if not source_raw: errors.append("source")
        if sorted(rationales.keys()) != list("ABCDE") or any(rationales[k]!=1 for k in "ABCDE"): errors.append("option-rationales")
        if correct_markers != [answer]: errors.append("correct-marker-mismatch")
        q={
            "id":f"CC-{sysid.upper()}-{int(m.group(1)):03d}",
            "number":int(m.group(1)), "difficulty":difficulty, "stem":stem,
            "options":options, "correctAnswer":answer, "correctAnswerText":answer_text,
            "initialExplanation":initial, "detailedExplanation":detailed,
            "highYieldPoints":highyield, "source":{"raw":source_raw,"sheet":sheet,"pages":pages},
            "validationErrors":errors, "validationWarnings":warnings
        }
        cases_by_key[case_key]["questions"].append(q)
        if topic_key not in topics_by_key:
            topics_by_key[topic_key]={"id":topic_key,"number":int(topic_ord),"name":topic_name,"cases":[]}
        # Attach case only once to its topic.
        if not any(c["id"]==case_key for c in topics_by_key[topic_key]["cases"]):
            topics_by_key[topic_key]["cases"].append(cases_by_key[case_key])
    # Some case headings might have no questions (flag them rather than silently omit).
    all_topic_q=sum(len(c["questions"]) for t in topics_by_key.values() for c in t["cases"])
    questions=[q for t in topics_by_key.values() for c in t["cases"] for q in c["questions"]]
    return {
        "id":sysid,"name":sysname,"sourceFile":filename,"questionCount":len(questions),
        "topicCount":len(topics_by_key),"caseCount":len(cases_by_key),
        "topics":list(topics_by_key.values())
    }, questions

def main():
    systems=[]; allq=[]; report={"systemReports":[],"errors":[]}
    for filename,sysid,sysname in SYSTEMS:
        system,qs=parse_system(filename,sysid,sysname)
        systems.append(system); allq.extend(qs)
        per=Counter(e for q in qs for e in q["validationErrors"])
        warns=Counter(e for q in qs for e in q["validationWarnings"])
        report["systemReports"].append({"system":sysname,"questions":len(qs),"topics":system["topicCount"],"cases":system["caseCount"],"validationErrors":dict(per),"validationWarnings":dict(warns)})
        for q in qs:
            for e in q["validationErrors"]:
                report["errors"].append({"system":sysname,"question":q["id"],"error":e})
    data={
        "schema":"shbace-clinical-case-bank-v1",
        "title":"Clinical Case",
        "description":"A clinical case-based question bank developed from the course sheets and teaching materials prepared by Dr. Abdulrahman Al-Juaiki. Questions are organized by medical system, topic and linked clinical case to support structured clinical reasoning and examination preparation.",
        "attribution":"Based on Dr. Abdulrahman Al-Juaiki's course sheets and the supplied Clinical Case Markdown banks.",
        "systems":systems,
        "totalQuestions":len(allq),
        "validation":{"passed":len(report["errors"])==0,"errorCount":len(report["errors"]),"systemReports":report["systemReports"],"errors":report["errors"][:200]}
    }
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    DEPLOYED_OUT = ROOT / "to me" / "data" / "clinicalCaseBank.json"
    DEPLOYED_OUT.parent.mkdir(parents=True, exist_ok=True)
    DEPLOYED_OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(json.dumps({"out":str(OUT),"totalQuestions":len(allq),"systems":report["systemReports"],"errorCount":len(report["errors"]),"errors":report["errors"][:30]},ensure_ascii=False,indent=2))
if __name__=="__main__": main()