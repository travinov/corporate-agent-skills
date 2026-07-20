## 1. Input Normalization

- [x] 1.1 Add shared workspace filename, diagram selection, and run selection helpers
- [x] 1.2 Accept positional natural-language create/improve requests while preserving explicit flags
- [x] 1.3 Accept short resume decisions/feedback and no-argument trace selection
- [x] 1.4 Add no-argument review selection and preserve positional/explicit artifact paths

## 2. Safety and Results

- [x] 2.1 Prevent create from overwriting targets at initialization or publication
- [x] 2.2 Report resolved inputs, selection reasons, ambiguity candidates, and concise next commands

## 3. Verification and Release

- [x] 3.1 Add unit tests for short forms, ambiguity, collision handling, compatibility, and zero agent calls before selection errors
- [x] 3.2 Update commands, SKILL, README, and reference documentation for conversational-first usage
- [x] 3.3 Bump installer and release metadata to `1.23.0-corporate.2`
- [x] 3.4 Run strict OpenSpec, skill, unit, installer, and release verification
- [x] 3.5 Build the offline ZIP, commit, push the new branch, and verify the download link
