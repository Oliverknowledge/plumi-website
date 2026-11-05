# Plumi calculator — source and credits

The calculator runs locally in your browser. It uses CalcWorld's Web-Calc-Emulator;
the emulator's source licence is included in LICENSE and its upstream README is
included in README.md in this directory.

Upstream source: https://github.com/CalcWorld/Web-Calc-Emulator
Version: 303124b0f18fc2e7b8ccd1efc5fffd390819e93e
Licence: AGPL-3.0; see LICENSE. The upstream README additionally states a
non-commercial restriction; this discrepancy needs clarification with the
maintainer before public release. Casio's permission does not resolve the
separate emulator author's terms.

Calculator model: CY234, fx-570/991EX.
Model ROM (core.dat) and face.svg were decoded from the CY234 model's base64
assets in https://github.com/RedZebra123H/calculator/blob/5c6cb574ba0ce9162165f331260a82bbc74df873/index.html
on 5 November 2026. The key map (keylog.json) was retrieved from
https://www.casperyc.club/CASIO-master/classpad/files/classwiz/CY234/keylog.json
on the same date. The CasperYC ROM download was incompatible and is not used.
These files and Casio branding are separate from the engine's licence.
Integration was requested on the basis of the founders' confirmation that Casio
has granted permission for use on Plumi.

Plumi modifications: registered the CY234 model; disabled root-level service
worker registration and the unrelated web-app manifest; added plumi-bridge.js
for readiness/errors, keyboard-accessible keys and Escape-to-minimise; allowed
normal Tab navigation; hid upstream toolbars in embedded mode. The vendored
face-plumi.svg adds a reference-inspired EX casing, textured face, solar-panel
detail and metallic controls, derived from the original face.svg without
changing key labels. It can be regenerated with scripts/calculator/build-skin.py.
The LCD, status display and key regions are offset together by 70px.
The keyboard handler also accepts shortcuts after focusing a key button, and
the worker dispatches ON directly to its hardware wake/reset method so OFF
does not strand the calculator. Queued input is held until the boot LCD returns;
busy AC polling preserves ordinary typing and input following cancellation.
Regression and real-firmware checks are provided in scripts/calculator/.
The vendored
HTML, JavaScript and WebAssembly files here are the vendored runtime. See the
upstream repository for its published source; a WebAssembly binary is not C++ source.

Source for Plumi's integration: https://github.com/Oliverknowledge/plumi-website
(Available there once the local integration changes have been published.)
