# Regenerate the Personality-Test QR code.
# Usage:  python make-qr.py "https://your-real-personality-test-link"
import sys, segno, os
url = sys.argv[1] if len(sys.argv) > 1 else "https://agatelevelup.com/personality-test-PLACEHOLDER"
out = os.path.join(os.path.dirname(__file__), "qr-personality.png")
qr = segno.make(url, error="h")
qr.save(out, scale=9, border=3, dark="#27385c", light="#ffffff")
print("QR written:", out)
print("Encodes:", url)
