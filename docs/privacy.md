---
layout: default
title: Privacy Policy
description: Privacy policy for the Udemy TTS browser extension.
---

<div class="page" markdown="1">

# Privacy Policy

_Last updated: July 2026_

Udemy TTS does not collect or store any personal data on developer-operated
servers. This policy explains what data the extension handles, and where it
goes.

## Information We Collect

- **Settings you configure**: your chosen translation/speech provider, API
  keys, target language, translator personality, pronunciation dictionary,
  and playback preferences (volume, speed, etc.).
- **Lecture content, while a lecture is open**: the subtitle text and the
  course/lecture title of the Udemy lecture you're currently viewing, read
  via Udemy's own API using your existing login session.

We do not ask for or collect your name, email address, or any other
personally identifiable information.

## How We Use Your Information

Your settings and the current lecture's subtitle text are used solely to
provide the extension's stated purpose: translating lecture subtitles and
reading them aloud. Nothing is used for analytics, advertising, or
profiling, and nothing is used for any purpose unrelated to this.

## Third-Party Services

Using the API key and provider you configure, the extension sends the
current lecture's subtitle text (for translation) and text to be spoken
(for speech synthesis) directly from your browser to the service you chose:

- Google Gemini API (Google AI Studio)
- OpenAI API
- OpenRouter
- A custom OpenAI-compatible endpoint you specify
- VOICEVOX Engine (running locally on your own machine)
- Microsoft Edge TTS (speech synthesis)

These requests go only to the provider you select; the developer does not
see, receive, or store this traffic. Each service's own privacy policy
governs how it handles the data you send it.

## Data Storage and Security

Your settings are stored only in your browser's synced storage
(`chrome.storage.sync` / `browser.storage.sync`), which syncs through your
browser vendor's own account system (Google or Mozilla), not through any
server operated by the developer. Requests to the services above are sent
over encrypted connections (HTTPS/WSS).

## Your Rights

All data described above already lives entirely under your control, in
your own browser. You can review, edit, or delete your settings, dictionary
entries, and translation cache at any time from the extension's options
page, or remove them completely by uninstalling the extension. Since the
developer never receives or stores this data, there is nothing held
elsewhere to request access to or deletion of.

## Changes to This Policy

If this policy changes, the updated version will be posted here with a new
"last updated" date.

## Contact

Questions can be sent via [GitHub Issues](https://github.com/rndomhack/udemy-tts/issues).

</div>
