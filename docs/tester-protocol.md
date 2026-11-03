# Fingerpost tester session protocol

This is the session plan, not evidence that a session happened. Fingerpost is an unfinished hackathon prototype. The current app implements camera/finger tracking, voice-named guidance, task turns and PIN protection, but tracking performance and real-world safety acceptance remain open. Mock targets do not recognize a real appliance. Check [progress](progress.md) before offering a feature for testing.

## Preparation and participation

A human facilitator arranges an optional 45-minute session, in person or by video call with the participant's own Android phone. Ask privately about language, accessible consent format, earphones and preferred setup. Offer English or Hindi consent. Explain the exact build and what works, including known delays. Guided target trials require the closed-loop implementation and its engineering checks; booking interest can be collected earlier.

The facilitator provides a working private reply channel for questions before enrollment. Do not put contact details, participant names, device models, serials or consent records in Git. Use an anonymous session code; identify the participant group only as `blind-user`, `low-vision-user` or `proxy`. Blindfolded teammates are `proxy` and never counted as blind-user results.

Read [the consent form](consent-form.md) aloud if requested. Participation, saved metrics, written notes, quotations and public name credit have separate yes/no choices. An unanswered choice means no. A person can stop, skip a task or decline any recording without having to give a reason.

Use practice touchscreen scenes and non-payment appliance controls. No real payment, banking session, real PIN, account credential or private screen is used. The simulator's payment button only changes a practice screen. PIN-pad exploration means synthetic keypad practice; it does not demonstrate completed PIN protection in the Android app.

## Agenda: 45 minutes

1. Consent and separate recording choices: 5 minutes.
2. TalkBack, earphone and app onboarding: 5 minutes.
3. Three single-target tasks across the appliance and simulator: 15 minutes.
4. From Day 4, one multi-step simulator task: 10 minutes. Before that feature is ready, reserve this block for setup, a break or optional unscored practice; do not describe it as a completed agent trial.
5. Synthetic PIN-pad exploration on the simulator: 5 minutes.
6. Interview and closing questions: 5 minutes.

This corrects the original agenda's 50-minute sum while keeping the 45-minute booking. Stop earlier whenever the participant wants; do not rush a participant to fit the schedule.

## Tasks and observations

For each target, read a short goal, let the participant attempt it, and record success, elapsed time, retries and facilitator help only when metrics consent is yes. Use safe, non-payment appliance controls. On the simulator, use the documented fast-food scene and synthetic keypad. Separate device/build failures from participant outcomes; an interrupted attempt is not a successful trial.

Ask whether directions were understandable, tone/pan changes were useful, response felt delayed, and the setup was comfortable. Keep the final interview to five minutes unless the participant chooses a separate follow-up. Do not infer comfort or success solely from silence.

## Data and consent handling

The current simulator automatically keeps tap events in page memory: run id, screen/element id, coordinates, pointer id and timestamp. It has no participant recording-off switch. Explain this and obtain separate metrics consent before simulator interaction. If declined, skip the simulator; do not promise an unrecorded simulator session. Close/reload its page after the session to discard its in-memory run, and do not export without permission.

The Android app has a gateway session client. Normal sessions can send speech and approved keyframes through the gateway to Meta Standard APIs; private/sensitive processing uses local speech and Glimmer for screen parsing. Explain the exact build, model mode, network processing and unverified limitations before use. Do not capture camera frames, screenshots of private surroundings, audio, video, transcripts or OCR text. Permission to save metrics or notes is not permission to save media. The donation implementation is off by default. Keep it off in tester sessions until physical redaction/PIN/consent and cloud IAM/lifecycle acceptance are recorded; ordinary tester consent is not donation consent.

With metrics consent, keep raw simulator exports and any consent records privately outside the repository. Store numerical outcomes and latency summaries under an anonymous session/run id; do not add personal details. Use the project's 30-day metrics retention limit from [ADR 0005](adr/0005-zero-retention.md); the human facilitator schedules deletion because local exports do not have an automatic TTL. Written notes and approved quotations also require their own explicit permission and a stated deletion date. Git reports contain only non-identifying aggregate results. Keep any private scheduling lookup separate so a participant can ask for deletion before anonymization.

Public quotations need separate permission for the exact proposed text. Public name credit additionally needs a separate yes and private confirmation of the credit text. Default to no quotation and no name credit. Do not commit identifiable notes, scheduling details or consent responses.

## Closing and outreach tracking

Ask for final questions, remind the participant how to reach the facilitator through the private invitation channel, and confirm the permitted data choices. Record only organization/channel, date, status and next step in [testers.md](testers.md). A human sends [the outreach drafts](outreach.md); creating these documents does not count as outreach or a completed session.
