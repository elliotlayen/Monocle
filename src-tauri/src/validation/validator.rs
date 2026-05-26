/// Character-level XML validation scanning.
///
/// Scans transcoded UTF-8 content for invalid XML characters, unescaped entities,
/// null bytes, control characters, and other byte-level issues per XML 1.0 spec.

use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ValidationProblem {
    pub line: u32,
    pub column: u32,
    pub end_column: u32,
    pub message: String,
    pub severity: String,
    pub code: String,
}

/// Check if a character is an invalid XML 1.0 character.
///
/// Per W3C XML 1.0 (Fifth Edition), valid characters are:
///   #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
///
/// This function returns true for characters that are INVALID in XML content.
fn is_invalid_xml_char(c: char) -> bool {
    matches!(c,
        '\u{0000}'                  |  // null byte
        '\u{0001}'..='\u{0008}'     |  // control chars
        '\u{000B}'                  |  // vertical tab
        '\u{000C}'                  |  // form feed
        '\u{000E}'..='\u{001F}'        // control chars
    )
}

/// Scan content for character-level validation problems.
///
/// Checks for:
/// - ERROR: null bytes (0x00)
/// - ERROR: invalid XML control characters (0x01-0x08, 0x0B, 0x0C, 0x0E-0x1F)
/// - ERROR: U+FFFD replacement characters when had_decode_errors is true
/// - WARNING: BOM detected
/// - WARNING: non-UTF8 encoding
/// - WARNING: bare CR without LF
pub fn validate_characters(
    content: &str,
    had_decode_errors: bool,
    encoding_name: &str,
    has_bom: bool,
) -> Vec<ValidationProblem> {
    let mut problems = Vec::new();

    // File-level warnings (always at line 1, col 1)
    if has_bom {
        problems.push(ValidationProblem {
            line: 1,
            column: 1,
            end_column: 1,
            message: "BOM detected (byte order mark)".to_string(),
            severity: "warning".to_string(),
            code: "bom-detected".to_string(),
        });
    }

    if encoding_name != "UTF-8" {
        problems.push(ValidationProblem {
            line: 1,
            column: 1,
            end_column: 1,
            message: format!("File encoded as {} (transcoded to UTF-8)", encoding_name),
            severity: "warning".to_string(),
            code: "non-utf8-encoding".to_string(),
        });
    }

    let mut line: u32 = 1;
    let mut column: u32 = 1;
    let chars: Vec<char> = content.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        let c = chars[i];

        match c {
            '\n' => {
                line += 1;
                column = 1;
                i += 1;
                continue;
            }
            '\r' => {
                if i + 1 < len && chars[i + 1] == '\n' {
                    // \r\n -- normal Windows line ending, skip both
                    line += 1;
                    column = 1;
                    i += 2;
                    continue;
                } else {
                    // Bare CR without LF -- warning
                    problems.push(ValidationProblem {
                        line,
                        column,
                        end_column: column + 1,
                        message: "Bare carriage return without line feed (unusual line ending)".to_string(),
                        severity: "warning".to_string(),
                        code: "bare-cr".to_string(),
                    });
                    line += 1;
                    column = 1;
                    i += 1;
                    continue;
                }
            }
            '\t' => {
                // Tab is valid in XML (0x09) -- just advance column
                column += 1;
                i += 1;
                continue;
            }
            _ => {}
        }

        // Check for null byte specifically (subset of invalid XML chars)
        if c == '\u{0000}' {
            problems.push(ValidationProblem {
                line,
                column,
                end_column: column + 1,
                message: "Null byte (0x00) detected".to_string(),
                severity: "error".to_string(),
                code: "null-byte".to_string(),
            });
        } else if c != '\u{0000}' && is_invalid_xml_char(c) {
            // Invalid XML control characters (not null, which is handled above)
            problems.push(ValidationProblem {
                line,
                column,
                end_column: column + 1,
                message: format!("Invalid XML control character (0x{:02X})", c as u32),
                severity: "error".to_string(),
                code: "invalid-control-char".to_string(),
            });
        }

        // Check for U+FFFD replacement characters when there were decode errors
        if c == '\u{FFFD}' && had_decode_errors {
            problems.push(ValidationProblem {
                line,
                column,
                end_column: column + 1,
                message: "Non-UTF-8 byte could not be transcoded (replaced with U+FFFD)".to_string(),
                severity: "error".to_string(),
                code: "non-utf8-byte".to_string(),
            });
        }

        column += 1;
        i += 1;
    }

    problems
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_file_produces_empty_vec() {
        let result = validate_characters("Hello world", false, "UTF-8", false);
        assert!(result.is_empty());
    }

    #[test]
    fn detects_null_byte() {
        let result = validate_characters("Hello\x00World", false, "UTF-8", false);
        let nulls: Vec<_> = result.iter().filter(|p| p.code == "null-byte").collect();
        assert_eq!(nulls.len(), 1);
        assert_eq!(nulls[0].line, 1);
        assert_eq!(nulls[0].column, 6);
        assert_eq!(nulls[0].severity, "error");
        assert_eq!(nulls[0].message, "Null byte (0x00) detected");
    }

    #[test]
    fn detects_control_chars() {
        // 0x01, 0x08, 0x0B, 0x0C, 0x1F
        let input = "A\x01B\x08C\x0BD\x0CE\x1FF";
        let result = validate_characters(input, false, "UTF-8", false);
        let controls: Vec<_> = result.iter().filter(|p| p.code == "invalid-control-char").collect();
        assert_eq!(controls.len(), 5);
        assert!(controls[0].message.contains("0x01"));
        assert!(controls[1].message.contains("0x08"));
        assert!(controls[2].message.contains("0x0B"));
        assert!(controls[3].message.contains("0x0C"));
        assert!(controls[4].message.contains("0x1F"));
    }

    #[test]
    fn xml_structural_chars_not_flagged() {
        let result = validate_characters("<root attr=\"a&amp;b\">text &lt; 5</root>", false, "UTF-8", false);
        assert!(result.is_empty());
    }

    #[test]
    fn detects_bare_cr() {
        let result = validate_characters("line1\rline2", false, "UTF-8", false);
        let crs: Vec<_> = result.iter().filter(|p| p.code == "bare-cr").collect();
        assert_eq!(crs.len(), 1);
        assert_eq!(crs[0].severity, "warning");
        assert_eq!(crs[0].message, "Bare carriage return without line feed (unusual line ending)");
    }

    #[test]
    fn does_not_flag_crlf() {
        let result = validate_characters("line1\r\nline2", false, "UTF-8", false);
        let crs: Vec<_> = result.iter().filter(|p| p.code == "bare-cr").collect();
        assert!(crs.is_empty());
    }

    #[test]
    fn bom_flag_produces_warning() {
        let result = validate_characters("content", false, "UTF-8", true);
        let boms: Vec<_> = result.iter().filter(|p| p.code == "bom-detected").collect();
        assert_eq!(boms.len(), 1);
        assert_eq!(boms[0].severity, "warning");
        assert_eq!(boms[0].line, 1);
        assert_eq!(boms[0].column, 1);
        assert_eq!(boms[0].message, "BOM detected (byte order mark)");
    }

    #[test]
    fn non_utf8_encoding_produces_warning() {
        let result = validate_characters("content", false, "windows-1252", false);
        let encs: Vec<_> = result.iter().filter(|p| p.code == "non-utf8-encoding").collect();
        assert_eq!(encs.len(), 1);
        assert_eq!(encs[0].severity, "warning");
        assert_eq!(encs[0].message, "File encoded as windows-1252 (transcoded to UTF-8)");
    }

    #[test]
    fn fffd_with_decode_errors() {
        let content = "Hello \u{FFFD} World";
        let result = validate_characters(content, true, "UTF-8", false);
        let ffrds: Vec<_> = result.iter().filter(|p| p.code == "non-utf8-byte").collect();
        assert_eq!(ffrds.len(), 1);
        assert_eq!(ffrds[0].severity, "error");
        assert_eq!(ffrds[0].message, "Non-UTF-8 byte could not be transcoded (replaced with U+FFFD)");
    }

    #[test]
    fn fffd_without_decode_errors_not_flagged() {
        // U+FFFD in content that was NOT caused by decode errors should not be flagged
        let content = "Hello \u{FFFD} World";
        let result = validate_characters(content, false, "UTF-8", false);
        let ffrds: Vec<_> = result.iter().filter(|p| p.code == "non-utf8-byte").collect();
        assert!(ffrds.is_empty());
    }

    #[test]
    fn line_column_tracking_accuracy() {
        // "AB\nCD\nEF" -- the 'E' is at line 3, column 1; 'F' is at line 3, column 2
        // Insert a null at 'E' position: "AB\nCD\n\x00F"
        let result = validate_characters("AB\nCD\n\x00F", false, "UTF-8", false);
        let nulls: Vec<_> = result.iter().filter(|p| p.code == "null-byte").collect();
        assert_eq!(nulls.len(), 1);
        assert_eq!(nulls[0].line, 3);
        assert_eq!(nulls[0].column, 1);
    }

    #[test]
    fn line_column_with_crlf() {
        // "AB\r\nCD\r\n\x00F" -- null is at line 3, col 1
        let result = validate_characters("AB\r\nCD\r\n\x00F", false, "UTF-8", false);
        let nulls: Vec<_> = result.iter().filter(|p| p.code == "null-byte").collect();
        assert_eq!(nulls.len(), 1);
        assert_eq!(nulls[0].line, 3);
        assert_eq!(nulls[0].column, 1);
    }

    #[test]
    fn tab_is_valid() {
        let result = validate_characters("col1\tcol2", false, "UTF-8", false);
        assert!(result.is_empty());
    }
}
