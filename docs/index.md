---
layout: default
title: Home
description: Listen to Udemy lectures in your own language, translated by an LLM and read aloud in real time.
---

<section class="hero">
  <img src="{{ '/assets/img/icon-128.png' | relative_url }}" alt="" width="88" height="88">
  <h1>Udemy TTS</h1>
  <p>
    A browser extension that translates Udemy lecture subtitles with an LLM and
    reads them aloud in real time, in sync with the video.
  </p>
  <div class="install-buttons">
    <a class="btn btn-primary" href="https://chromewebstore.google.com/detail/udemy-tts-translate-read/fpahgagojcmdedfpmhmjhaefgobadlpc">Add to Chrome</a>
    <a class="btn btn-secondary" href="https://addons.mozilla.org/firefox/addon/udemy-tts/">Add to Firefox</a>
  </div>
</section>

## Features

<ul class="features">
  <li>
    <strong>Multiple translation providers</strong>
    <span>Google Gemini, OpenAI, OpenRouter, or your own OpenAI-compatible endpoint, plus free on-device machine translation in Chrome and Edge. Only low-cost, fast models are offered as presets.</span>
  </li>
  <li>
    <strong>Translator personality</strong>
    <span>Standard, concise, and friendly presets, or write your own custom instructions for how translations should read.</span>
  </li>
  <li>
    <strong>Accurate translation</strong>
    <span>Indexed JSON with structured output keeps every line matched to its source. Gaps are retried as whole chunks, and playback never stops even if a translation is missing.</span>
  </li>
  <li>
    <strong>Translation cache</strong>
    <span>Results are cached per lecture, so revisiting a course doesn't re-translate it. Review, delete, or clear the cache from the options page.</span>
  </li>
  <li>
    <strong>Two speech engines</strong>
    <span>Edge TTS by default, or VOICEVOX for a different Japanese voice, running on your own machine.</span>
  </li>
  <li>
    <strong>Automatic speed adjustment</strong>
    <span>Playback speed adapts continuously to keep the narration in sync with the video, and is guaranteed to catch up before the lecture ends.</span>
  </li>
  <li>
    <strong>Pause &amp; resume that just works</strong>
    <span>Pausing the video pauses the narration at the same spot. A watchdog recovers automatically if a media key accidentally stops only the audio.</span>
  </li>
  <li>
    <strong>Pronunciation overrides</strong>
    <span>A personal dictionary plus a lecture-specific list the LLM generates automatically, so technical terms and names are read correctly.</span>
  </li>
  <li>
    <strong>Subtitle overlay</strong>
    <span>Optionally show the translated (or original) text over the video, independent of narration, and drag it wherever you like.</span>
  </li>
  <li>
    <strong>Built-in setup guide</strong>
    <span>Step-by-step instructions for getting an API key and configuring billing for each provider, bundled right into the extension.</span>
  </li>
</ul>

## How it works

<ol class="steps">
  <li>Open the extension's options page, choose a translation provider, add your API key, and run "Test connection".</li>
  <li>Open any Udemy lecture — a control button is added to the video player.</li>
  <li>Use the panel to toggle translation, narration, and the subtitle overlay, and to adjust volume and speed.</li>
</ol>

Works on both Chrome and Firefox (Manifest V3). Source code and issue tracker are on [GitHub](https://github.com/rndomhack/udemy-tts).
