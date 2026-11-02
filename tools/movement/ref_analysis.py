#!/usr/bin/env python3
"""
Measures movement dynamics from a screen recording of a 2D top-down game (the reference clip). Method, in the order it runs
(the numbers it prints are the ones in docs/study/art/movement-reference.md and tools/movement/target.json):

  1. decode every frame (cv2), scale to the CSS viewport (the recording is retina: native / 2), keep a uint8 memmap
  2. CAMERA: phase correlation (cv2.phaseCorrelate, Hanning window) between consecutive frames over the floor region,
     accumulated. Sub-pixel; the HUD is outside the region.
  3. BACKGROUND: warp every 6th frame into world coordinates (screen minus camera) and take the per-pixel median over
     time. Everything that moves (the walker) vanishes; the static room stays.
  4. WALKER: per frame, warp to world, subtract the background, keep pixels of the walker's head colour; the largest
     connected blob that is the right size and nearest the previous one is the head. Its centroid is the position
     (the shadow, purple, is segmented the same way and gives the ground point).
  5. SPEED: per-frame displacement over real frame times (pts); runs of held keys are found by direction; slope of a
     linear fit over each run = steady speed. Start and stop are read frame by frame.
  6. POSE SLOTS: sprite patches (foreground mask in world coordinates around the head) are compared with a small search
     over shifts; a jump in the minimum difference marks a pose change. Slot lengths and the repeating sequence follow.

Usage: python3 ref_analysis.py reference-movement.mov --work /tmp/refwork [--css-width 1512]
Needs: numpy, opencv-python-headless. Writes work/frames.npy (3 GB for a 740 frame 1512x949 clip): delete it after.
Art pixel size is calibrated from the walker's edges: gradient energy folded at candidate periods (6.0 native px = 3 css px).
"""
import argparse, json, os, subprocess
import numpy as np, cv2


def decode(video, work, css_w):
    cap = cv2.VideoCapture(video)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    ok, f = cap.read()
    h = int(round(f.shape[0] * css_w / f.shape[1]))
    mm = np.lib.format.open_memmap(os.path.join(work, 'frames.npy'), mode='w+', dtype=np.uint8, shape=(n, h, css_w, 3))
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    for i in range(n):
        ok, f = cap.read()
        if not ok:
            break
        mm[i] = cv2.resize(f, (css_w, h), interpolation=cv2.INTER_AREA)
    mm.flush()
    # real presentation times (the clip is variable frame rate)
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', video], capture_output=True, text=True).stdout
    t = np.array([float(x.strip(',')) for x in out.split() if x.strip(',')])
    return mm, t[:n]


def camera(F, roi=(330, 1250, 345, 870)):
    x0, x1, y0, y1 = roi
    win = cv2.createHanningWindow((x1 - x0, y1 - y0), cv2.CV_32F)
    g = lambda i: cv2.cvtColor(np.array(F[i, y0:y1, x0:x1]), cv2.COLOR_BGR2GRAY).astype(np.float32)
    d = np.zeros((len(F), 2))
    prev = g(0)
    for i in range(1, len(F)):
        cur = g(i)
        (dx, dy), _ = cv2.phaseCorrelate(prev, cur, win)
        d[i] = (dx, dy)
        prev = cur
    return np.cumsum(d, 0)


def background(F, cam, OX=300, OY=100, step=6):
    H, W = F.shape[1:3]
    CW, CH = W + 600, H + 200
    valid = np.zeros((H, W), np.uint8)
    valid[112:868, 330:1445] = 1
    valid[:372, :330] = 0   # HUD panels
    sel = list(range(0, len(F), step))
    stack = np.zeros((len(sel), CH, CW, 3), np.uint8)
    vs = np.zeros((len(sel), CH, CW), np.uint8)
    for k, i in enumerate(sel):
        M = np.float32([[1, 0, OX - cam[i, 0]], [0, 1, OY - cam[i, 1]]])
        stack[k] = cv2.warpAffine(np.array(F[i]), M, (CW, CH))
        vs[k] = cv2.warpAffine(valid, M, (CW, CH), flags=cv2.INTER_NEAREST)
    bg = np.zeros((CH, CW, 3), np.uint8)
    for y0 in range(0, CH, 100):
        s = stack[:, y0:y0 + 100].astype(np.float32)
        s[~(vs[:, y0:y0 + 100] > 0)] = np.nan
        bg[y0:y0 + 100] = np.nan_to_num(np.nanmedian(s, axis=0)).astype(np.uint8)
    return bg, valid


def track_head(F, cam, bg, valid, head_rgb=(182, 160, 131), OX=300, OY=100):
    """Head centroid (world coordinates) per frame; NaN where not found. head_rgb: sampled once from a frame."""
    H, W = F.shape[1:3]
    CW, CH = W + 600, H + 200
    tr = np.full((len(F), 6), np.nan)
    prev = None
    for i in range(len(F)):
        M = np.float32([[1, 0, OX - cam[i, 0]], [0, 1, OY - cam[i, 1]]])
        w = cv2.warpAffine(np.array(F[i]), M, (CW, CH), flags=cv2.INTER_NEAREST)
        v = cv2.warpAffine(valid, M, (CW, CH), flags=cv2.INTER_NEAREST)
        fg = (np.abs(w.astype(np.int16) - bg.astype(np.int16)).sum(2) > 50) & (v > 0)
        R, G, B = w[..., 2].astype(int), w[..., 1].astype(int), w[..., 0].astype(int)
        m = fg & (abs(R - head_rgb[0]) < 22) & (abs(G - head_rgb[1]) < 22) & (abs(B - head_rgb[2]) < 22)
        mm = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        n, lab, st, cen = cv2.connectedComponentsWithStats(mm)
        c = [(st[k, 4], st[k, 0], st[k, 1], st[k, 2], st[k, 3], cen[k, 0], cen[k, 1]) for k in range(1, n)
             if 1300 < st[k, 4] < 2000 and 38 <= st[k, 2] <= 50 and 48 <= st[k, 3] <= 64]
        if not c:
            continue
        q = max(c) if prev is None else min(c, key=lambda q: (q[5] - prev[0]) ** 2 + (q[6] - prev[1]) ** 2)
        if prev is not None and (q[5] - prev[0]) ** 2 + (q[6] - prev[1]) ** 2 > 40 ** 2:
            continue
        prev = (q[5], q[6])
        tr[i] = (q[5], q[6], q[2], q[2] + q[4], q[1], q[1] + q[3])
    return tr


def runs_of_motion(tr, t, thresh=60):
    """Runs of held keys: direction label per frame from the 5-frame mean velocity, then a linear fit per run."""
    x, y = tr[:, 0].copy(), tr[:, 1].copy()
    for a in (x, y):
        m = np.isnan(a)
        a[m] = np.interp(t[m], t[~m], a[~m])
    N = len(t)
    vx = np.zeros(N); vy = np.zeros(N)
    for i in range(1, N):
        vx[i] = (x[i] - x[i - 1]) / (t[i] - t[i - 1]); vy[i] = (y[i] - y[i - 1]) / (t[i] - t[i - 1])

    def lab(i, k=2):
        lo, hi = max(1, i - k), min(N - 1, i + k)
        ax, ay = vx[lo:hi + 1].mean(), vy[lo:hi + 1].mean()
        if np.hypot(ax, ay) < thresh: return '0'
        if abs(ay) < 0.25 * abs(ax): return 'R' if ax > 0 else 'L'
        if abs(ax) < 0.25 * abs(ay): return 'D' if ay > 0 else 'U'
        return ('D' if ay > 0 else 'U') + ('R' if ax > 0 else 'L')
    labs = [lab(i) for i in range(N)]
    res, s = [], 0
    for i in range(1, N + 1):
        if i == N or labs[i] != labs[s]:
            if i - s >= 8:
                a, b = s, i - 1
                px = np.polyfit(t[a + 1:b], x[a + 1:b], 1)[0]; py = np.polyfit(t[a + 1:b], y[a + 1:b], 1)[0]
                res.append(dict(dir=labs[s], idx=[a, b], t=[round(t[a], 3), round(t[b], 3)], css_px_per_s=round(float(np.hypot(px, py)), 1)))
            s = i
    return res


def pose_changes(F, cam, bg, tr, a, b, S=6, OX=300, OY=100):
    """Frames in [a, b] where the sprite pose changes (min patch difference over +-S px shifts jumps)."""
    H, W = F.shape[1:3]
    CW, CH = W + 600, H + 200
    PW, PH, UP = 44, 150, 36

    def patch(i):
        M = np.float32([[1, 0, OX - cam[i, 0]], [0, 1, OY - cam[i, 1]]])
        w = cv2.warpAffine(np.array(F[i]), M, (CW, CH), flags=cv2.INTER_NEAREST)
        cx, cy = int(round(tr[i, 0])), int(round(tr[i, 1]))
        y0, x0 = cy - UP, cx - PW
        p = w[y0:y0 + PH, x0:x0 + 2 * PW].astype(np.int16); q = bg[y0:y0 + PH, x0:x0 + 2 * PW].astype(np.int16)
        m = cv2.morphologyEx((np.abs(p - q).sum(2) > 45).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
        return p, m

    def dist(A, B):
        (pa, ma), (pb, mb) = A, B
        best = 1e9
        for dy in range(-S, S + 1):
            for dx in range(-S, S + 1):
                ys, yd = slice(max(0, dy), PH + min(0, dy)), slice(max(0, -dy), PH + min(0, -dy))
                xs, xd = slice(max(0, dx), 2 * PW + min(0, dx)), slice(max(0, -dx), 2 * PW + min(0, -dx))
                u = ma[ys, xs] | mb[yd, xd]
                if u.sum():
                    best = min(best, (np.abs(pa[ys, xs] - pb[yd, xd]).sum(2) * u).sum() / u.sum())
        return best
    P = {i: patch(i) for i in range(a, b + 1)}
    return [i + 1 for i in range(a, b) if dist(P[i], P[i + 1]) > 7]


def art_pixel(video_frame_native, box):
    x0, y0, x1, y1 = box
    g = cv2.cvtColor(video_frame_native, cv2.COLOR_BGR2GRAY).astype(float)[y0:y1, x0:x1]
    p = np.abs(np.diff(g, axis=1)).sum(0)
    best = []
    for per in np.arange(4, 12, 0.05):
        bins = np.zeros(int(np.ceil(per)))
        for k, v in enumerate(p):
            bins[int((k % per))] += v
        best.append((bins.max() / bins.sum(), per))
    return sorted(best, reverse=True)[0][1]


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('--work', required=True); ap.add_argument('--css-width', type=int, default=1512)
    ap.add_argument('--pose-range', default='90,160', help='frames of a clean straight walk to find pose slots in')
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    F, t = decode(a.video, a.work, a.css_width)
    cam = camera(F)
    bg, valid = background(F, cam)
    tr = track_head(F, cam, bg, valid)
    runs = runs_of_motion(tr, t)
    lo, hi = map(int, a.pose_range.split(','))
    ch = pose_changes(F, cam, bg, tr, lo, hi)
    slot_ms = np.diff(t[ch]) * 1000
    sx = tr[:, 0] + cam[:, 0] - 300
    out = dict(frames=len(F), seconds=round(float(t[-1]), 2), camera_range_css=[cam.min(0).round(1).tolist(), cam.max(0).round(1).tolist()],
               runs=runs, steady_speed_css_px_per_s=round(float(np.median([r['css_px_per_s'] for r in runs if r['css_px_per_s'] > 200])), 1),
               pose_change_frames=ch, pose_slot_ms_mean=round(float(slot_ms.mean()), 1), pose_rate_hz=round(1000 / float(slot_ms.mean()), 2),
               player_screen_x_when_camera_moves=dict(median=round(float(np.nanmedian(sx[np.abs(np.diff(cam[:, 0], prepend=0)) > 1])), 1)))
    print(json.dumps(out, indent=1))
