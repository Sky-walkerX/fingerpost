import AppKit
import CoreImage
let target = "https://github.com/Sky-walkerX/fingerpost/releases/latest"
let filter = CIFilter(name: "CIQRCodeGenerator")!
filter.setValue(target.data(using: .utf8)!, forKey: "inputMessage")
filter.setValue("M", forKey: "inputCorrectionLevel")
let qr = filter.outputImage!
let border = qr.extent.insetBy(dx: -4, dy: -4)
let white = CIImage(color: CIColor.white).cropped(to: border)
let output = qr.composited(over: white).transformed(by: CGAffineTransform(scaleX: 8, y: 8))
let context = CIContext()
let bitmap = NSBitmapImageRep(cgImage: context.createCGImage(output, from: output.extent)!)
let data = bitmap.representation(using: .png, properties: [:])!
let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: context, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
let decoded = detector.features(in: CIImage(data: data)!).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
guard decoded == [target] else { fatalError("QR decode verification failed") }
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
print("Release QR generated and independently decoded.")
