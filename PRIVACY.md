# Tube Focus Mode with Jev: Privacy Policy

_Last updated: 15 October 2026_

Tube Focus Mode is a browser extension that filters YouTube down to what you're focusing on. It's built by Oriol Segarra (Síntesi Studio). This page explains exactly what data it touches and where that data goes.

## The short version

- No account, no analytics, no tracking, no ads. We don't run a server, so we never receive your data.
- Your settings stay in your browser. Your TypeSafe API key stays on this device.
- Only if you turn on topic checks: the title, channel name and description of YouTube videos you come across are sent to TypeSafe, using your own API key, so its Jev model can say whether a video matches your focus topics.

## What's stored, and where

| Data | Where it lives | Leaves your browser? |
|---|---|---|
| Your settings (focus topics, allowed channels, pinned videos, locked hours, threshold) | Chrome sync storage | Only to your own Google account, if you use Chrome Sync |
| Your TypeSafe API key | Chrome local storage on this device | Only to TypeSafe, as the login for each topic check |
| Jev's scores for videos it has checked (video ID and a number from 0 to 1) | Chrome local storage on this device | No |
| How many topic checks you've used today | Chrome local storage on this device | No |

## What's sent to TypeSafe

When topic checks are on, and a video isn't already covered by an allowed channel or a pin, the extension sends this to `api.typesafe.ai`:

- the video's title, channel name and up to 500 characters of its description;
- the focus topics you wrote in the extension;
- your TypeSafe API key, to authorise the request.

Nothing else is sent: not your YouTube account, your watch history, or any other page you visit. (Like any web request, TypeSafe can see the IP address the request comes from.) Each video is checked once (twice at most: once from the homepage, once when opened), and the answer is remembered on your device.

TypeSafe handles this data under its own privacy policy and terms (https://typesafe.ai). We don't control how TypeSafe stores or uses it.

You can turn topic checks off at any time in the extension popup ("Stop sending videos to TypeSafe"). Allowed channels and pinned videos keep working without it.

## Channel lookups on YouTube

When you allow a channel by its @handle, the extension opens that channel's YouTube page once in the background (from your YouTube tab) to learn its display name and channel ID. This goes to YouTube only, like any page you'd visit there, and the result is stored on this device.

## What we don't do

- We don't sell, rent or share your data with anyone.
- We don't use your data for advertising, credit decisions or anything unrelated to filtering YouTube.
- We don't collect data from children knowingly; the extension has no accounts at all.

The use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Deleting your data

Uninstalling the extension deletes everything it stored in your browser, including its synced settings.

## Contact

Questions: get in touch through https://sintesi.studio
