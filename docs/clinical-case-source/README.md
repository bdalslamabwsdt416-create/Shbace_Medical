# Clinical Case Bank ? Source Markdown

These ten Markdown files are the source snapshots used to generate Bank 07 (for Chrome/data/clinicalCaseBank.json).

They are retained in the repository so the bank can be audited and regenerated without depending on a path on one developer's Desktop. The source files contain the question, options, answer key, initial explanation, option-by-option detailed explanation, high-yield notes, case narrative, topic heading, and the source sheet/page citation.

## Included systems

- Central Nervous System
- Cardiovascular System
- Endocrine System
- Gastrointestinal System
- Hematology
- Infectious Diseases
- Neonatology
- Nephrology
- Pediatric Vaccination
- Respiratory System

## Regenerate

From the repository root, run:

    python tools/build_clinical_case_bank.py

The script writes for Chrome/data/clinicalCaseBank.json and checks the five options, answer key, option-level rationale labels, initial/detailed/high-yield explanations, and source citation for every question.

The referenced course-sheet PDFs are not copied into the PWA bundle. The student-facing Read More section shows the sheet name and page range recorded in the Markdown source.
