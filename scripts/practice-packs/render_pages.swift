// Renders pages of a practice pack PDF to PNG, for the pack pages' cover and sample images.
//
//     swift scripts/practice-packs/render_pages.swift <pack.pdf> <out-dir> <name>:<page> [<name>:<page> ...] [--width=1200]
//
// e.g. ... questions.pdf .work cover:1 question:3 writes .work/cover.png and .work/question.png;
// build.sh turns them into WebP in public/practice-packs/<slug>/. macOS only (PDFKit).
import AppKit
import PDFKit

let args = CommandLine.arguments.dropFirst()
let positional = args.filter { !$0.hasPrefix("--") }
guard positional.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: positional[positional.startIndex])) else {
  FileHandle.standardError.write("usage: render_pages.swift <pdf> <out-dir> <name>:<page> ...\n".data(using: .utf8)!)
  exit(1)
}
let out = URL(fileURLWithPath: positional[positional.startIndex + 1])
let width = CGFloat(Double(args.first { $0.hasPrefix("--width=") }?.dropFirst(8) ?? "") ?? 1200)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

for spec in positional.dropFirst(2) {
  let parts = spec.split(separator: ":")
  guard parts.count == 2, let n = Int(parts[1]), let page = doc.page(at: n - 1) else { continue }
  let box = page.bounds(for: .mediaBox)
  let scale = width / box.width
  let size = CGSize(width: width, height: (box.height * scale).rounded())
  let image = NSImage(size: size)
  image.lockFocus()
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.setFillColor(NSColor.white.cgColor)
  ctx.fill(CGRect(origin: .zero, size: size))
  ctx.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx)
  image.unlockFocus()
  let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
  try rep.representation(using: .png, properties: [:])!.write(to: out.appendingPathComponent("\(parts[0]).png"))
  print("\(parts[0]).png  page \(n)  \(Int(size.width))x\(Int(size.height))")
}
