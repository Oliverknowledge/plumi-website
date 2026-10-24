// Read the text of scanned pages with Apple's Vision framework (macOS only).
//
//     swift scripts/question-bank/edexcel_sciences/ocr.swift page-01.png page-02.png …
//
// Prints one JSON object per image: {"file": …, "w": …, "h": …, "lines": [{"text", "x0", "y0", "x1", "y1"}]},
// with boxes in the image's pixels, top-left origin. cut_pearson.py uses it for the
// few papers Pearson published as scans, which have no text layer to read labels from.
import Foundation
import Vision
import AppKit

for path in CommandLine.arguments.dropFirst() {
    guard let image = NSImage(contentsOfFile: path),
          let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let w = Double(cg.width), h = Double(cg.height)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
    var lines: [[String: Any]] = []
    for obs in request.results ?? [] {
        guard let best = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox  // normalised, bottom-left origin
        lines.append(["text": best.string, "x0": b.minX * w, "y0": (1 - b.maxY) * h, "x1": b.maxX * w, "y1": (1 - b.minY) * h])
    }
    let out: [String: Any] = ["file": path, "w": w, "h": h, "lines": lines]
    if let data = try? JSONSerialization.data(withJSONObject: out), let s = String(data: data, encoding: .utf8) { print(s) }
}
