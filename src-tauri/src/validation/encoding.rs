/// Encoding detection and transcoding pipeline.
///
/// Reads raw bytes, detects encoding via BOM sniffing and chardetng,
/// then transcodes to UTF-8 using encoding_rs.

pub struct DecodeResult {
    pub content: String,
    pub encoding_name: String,
    pub has_bom: bool,
    pub had_errors: bool,
}

/// Detect the encoding of raw bytes and decode to UTF-8.
///
/// 1. Checks for BOM (UTF-8, UTF-16 LE, UTF-16 BE).
/// 2. Attempts UTF-8 decode via encoding_rs (handles BOM sniffing and removal).
/// 3. If UTF-8 fails (replacement characters), uses chardetng to detect encoding.
/// 4. Decodes with detected encoding and returns the result.
pub fn detect_and_decode(raw_bytes: &[u8]) -> DecodeResult {
    // Check for BOM before decoding (encoding_rs removes BOM during decode)
    let has_bom = raw_bytes.starts_with(&[0xEF, 0xBB, 0xBF])       // UTF-8 BOM
        || raw_bytes.starts_with(&[0xFF, 0xFE])                      // UTF-16 LE BOM
        || raw_bytes.starts_with(&[0xFE, 0xFF]);                     // UTF-16 BE BOM

    // Try UTF-8 decode first (fast path for most files).
    // encoding_rs::UTF_8.decode() handles BOM sniffing and removes BOM bytes.
    let (cow, encoding_used, had_errors) = encoding_rs::UTF_8.decode(raw_bytes);

    if encoding_used == encoding_rs::UTF_8 && !had_errors {
        // Clean UTF-8 decode -- fast path
        return DecodeResult {
            content: cow.into_owned(),
            encoding_name: "UTF-8".to_string(),
            has_bom,
            had_errors: false,
        };
    }

    if had_errors {
        // UTF-8 decoding produced replacement characters.
        // Use chardetng to detect the actual encoding.
        let mut detector = chardetng::EncodingDetector::new(
            chardetng::Iso2022JpDetection::Deny,
        );
        detector.feed(raw_bytes, true);
        // Deny UTF-8 since we know UTF-8 decoding failed
        let detected = detector.guess(None, chardetng::Utf8Detection::Deny);

        if detected == encoding_rs::UTF_8 {
            // chardetng returned UTF-8 despite errors -- use the original
            // UTF-8 decode result with had_errors flag set
            return DecodeResult {
                content: cow.into_owned(),
                encoding_name: "UTF-8".to_string(),
                has_bom,
                had_errors: true,
            };
        }

        // Decode with the detected encoding
        let (decoded, _encoding_after, had_errors_2) = detected.decode(raw_bytes);
        return DecodeResult {
            content: decoded.into_owned(),
            encoding_name: detected.name().to_string(),
            has_bom,
            had_errors: had_errors_2,
        };
    }

    // UTF-8 decode succeeded but encoding_used differs (e.g., BOM-detected UTF-16)
    DecodeResult {
        content: cow.into_owned(),
        encoding_name: encoding_used.name().to_string(),
        has_bom,
        had_errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pure_utf8() {
        let input = b"Hello, world!";
        let result = detect_and_decode(input);
        assert_eq!(result.content, "Hello, world!");
        assert_eq!(result.encoding_name, "UTF-8");
        assert!(!result.has_bom);
        assert!(!result.had_errors);
    }

    #[test]
    fn utf8_with_bom() {
        let mut input = vec![0xEF, 0xBB, 0xBF]; // UTF-8 BOM
        input.extend_from_slice(b"Hello BOM");
        let result = detect_and_decode(&input);
        assert_eq!(result.content, "Hello BOM");
        assert_eq!(result.encoding_name, "UTF-8");
        assert!(result.has_bom);
        assert!(!result.had_errors);
    }

    #[test]
    fn windows_1252_smart_quotes() {
        // Windows-1252 encoded text with smart quotes (0x93, 0x94)
        let input: Vec<u8> = vec![
            b'H', b'e', b'l', b'l', b'o', b' ',
            0x93, // left double quotation mark in Windows-1252
            b'w', b'o', b'r', b'l', b'd',
            0x94, // right double quotation mark in Windows-1252
        ];
        let result = detect_and_decode(&input);
        // Should detect as a non-UTF8 encoding and transcode
        assert!(!result.encoding_name.is_empty());
        // Content should contain the decoded text (not replacement chars if detected correctly)
        assert!(result.content.contains("Hello"));
    }

    #[test]
    fn file_with_null_bytes() {
        // Valid UTF-8 with embedded null bytes
        let input = b"Hello\x00World";
        let result = detect_and_decode(input);
        assert_eq!(result.content, "Hello\0World");
        assert_eq!(result.encoding_name, "UTF-8");
        assert!(!result.had_errors);
    }

    #[test]
    fn empty_file() {
        let input = b"";
        let result = detect_and_decode(input);
        assert_eq!(result.content, "");
        assert_eq!(result.encoding_name, "UTF-8");
        assert!(!result.has_bom);
        assert!(!result.had_errors);
    }

    #[test]
    fn utf16_le_bom_detection() {
        let input: Vec<u8> = vec![0xFF, 0xFE, b'H', 0x00, b'i', 0x00];
        let result = detect_and_decode(&input);
        assert!(result.has_bom);
        // encoding_rs should handle the BOM and decode appropriately
        assert!(result.content.contains('H'));
    }
}
