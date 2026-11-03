#!/usr/bin/env python3
"""
Judder of the recorded clip, measured where it is made: the SCREEN position (device px) of the lead animals' feet in every recorded frame (social5.mjs writes judder-outdoor.json
and judder-indoor.json beside the frames) and of the camera. A glide is smooth when the step from one frame to the next changes by no more than about 1 px (the engine puts a sprite
on a whole device pixel, so a step of 9.3 px is 9 or 10).

  python3 tools/clip/judder.py DIR/landscape [DIR/vertical ...]
"""
import json, os, sys
import numpy as np

def report(name, pos, valid):
    p = np.array(pos, float)
    ok = valid[2:] & valid[1:-1] & valid[:-2]
    ok[:2] = False                                                    # the first frames are the recorder's own set-up
    st = np.diff(p, axis=0)
    var = np.abs(np.diff(st, axis=0))[ok[: len(st) - 1]] if len(st) > 1 else np.array([])
    var = np.hypot(var[:, 0], var[:, 1]) if len(var) else var
    v = np.hypot(st[:, 0], st[:, 1])[valid[1:] & valid[:-1]]
    if not len(var):
        print(f"  {name}: no moving frames"); return None
    big = [int(i) + 1 for i in np.where(np.hypot(*np.abs(np.diff(st, axis=0)).T) * ok[: len(st) - 1] > 3)[0]]
    print(f"  {name}: {int(ok.sum())} frames, speed {v.mean():.1f} px/frame, change of the step between frames: p50 {np.percentile(var, 50):.2f}, p95 {np.percentile(var, 95):.2f}, p99 {np.percentile(var, 99):.2f}, max {var.max():.2f} px; frames over 3 px: {big}")
    return float(var.max())

for d in sys.argv[1:]:
    print(d)
    f = os.path.join(d, "judder-outdoor.json")
    if os.path.exists(f):
        j = np.array(json.load(open(f)), float)                       # per frame: x0 y0 x1 y1 camx camy
        n = len(j)
        for i, nm in enumerate(("Mochi (screen)", "Juniper (screen)")):
            pos = j[:, 2 * i:2 * i + 2]
            # only frames where the walker is on screen and has not yet walked in (the engine parks a walker that has reached the door)
            valid = (np.abs(pos[:, 0]) < 4000) & (np.abs(pos[:, 1]) < 4000)
            report("outdoor " + nm, pos, valid)
        cam = j[:, 4:6]
        c2 = np.abs(np.diff(cam, 2, axis=0))
        print(f"  outdoor camera (art px): max acceleration {np.hypot(c2[:,0], c2[:,1]).max():.3f} art px/frame^2; max speed {np.hypot(*np.diff(cam, axis=0).T).max():.2f} art px/frame")
    f = os.path.join(d, "judder-indoor.json")
    if os.path.exists(f):
        j = np.array(json.load(open(f)), float)                       # per frame: x y walking (Mochi), x y walking (Juniper), camx*k camy*k
        for i, nm in enumerate(("Mochi", "Juniper")):
            pos = j[:, 3 * i:3 * i + 2]
            walking = j[:, 3 * i + 2] > 0
            valid = walking & np.isfinite(pos).all(1)
            report("indoor " + nm + " (screen, walking)", np.nan_to_num(pos), valid)
        cam = j[:, 6:8]
        st = np.abs(np.diff(cam, axis=0))
        print(f"  indoor camera (device px): largest step {st.max():.1f} px/frame; change of step max {np.abs(np.diff(cam, 2, axis=0)).max():.2f} px")
