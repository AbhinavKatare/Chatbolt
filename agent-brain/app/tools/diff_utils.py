import re
import difflib
from typing import List, Dict, Any, Tuple, Optional

DIFF_LINE_THRESHOLD = 20
DIFF_BYTE_THRESHOLD = 500
MAX_TOOL_OUTPUT_BYTES = 1500
MAX_TOOL_OUTPUT_LINES = 30

def should_use_diff(content: str) -> bool:
    """
    Determines if a file edit should default to a targeted diff rather than a full-file rewrite.
    Files over 20 lines or 500 bytes use diffs; smaller or new files can use full file generation.
    """
    if not content:
        return False
    lines = content.splitlines()
    if len(lines) > DIFF_LINE_THRESHOLD or len(content.encode('utf-8')) > DIFF_BYTE_THRESHOLD:
        return True
    return False

def generate_unified_diff(original: str, modified: str, file_path: str = "file") -> str:
    """Generates standard unified diff format between original and modified text."""
    orig_lines = original.splitlines(keepends=True)
    mod_lines = modified.splitlines(keepends=True)
    diff = difflib.unified_diff(
        orig_lines,
        mod_lines,
        fromfile=f"a/{file_path}",
        tofile=f"b/{file_path}",
        lineterm=""
    )
    return "".join(diff)

def parse_unified_diff(diff_text: str) -> List[Dict[str, Any]]:
    """
    Parses unified diff format or targeted chunk markers into structured hunks.
    """
    hunks = []
    lines = diff_text.splitlines()
    current_hunk = None
    
    hunk_header_re = re.compile(r"^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@")
    
    for line in lines:
        match = hunk_header_re.match(line)
        if match:
            if current_hunk:
                hunks.append(current_hunk)
            orig_start = int(match.group(1))
            orig_len = int(match.group(2) or 1)
            current_hunk = {
                "start_line": orig_start,
                "end_line": orig_start + orig_len - 1,
                "target_content": "",
                "replacement_content": "",
                "orig_lines": [],
                "new_lines": []
            }
            continue
            
        if current_hunk:
            if line.startswith("-"):
                current_hunk["orig_lines"].append(line[1:])
            elif line.startswith("+"):
                current_hunk["new_lines"].append(line[1:])
            elif line.startswith(" "):
                current_hunk["orig_lines"].append(line[1:])
                current_hunk["new_lines"].append(line[1:])
                
    if current_hunk:
        hunks.append(current_hunk)
        
    for h in hunks:
        h["target_content"] = "\n".join(h["orig_lines"])
        h["replacement_content"] = "\n".join(h["new_lines"])
        
    return hunks

def progressive_truncate_tool_output(
    output: Any,
    max_bytes: int = MAX_TOOL_OUTPUT_BYTES,
    max_lines: int = MAX_TOOL_OUTPUT_LINES,
    tool_name: str = "tool"
) -> Dict[str, Any]:
    """
    Summarizes / truncates tool and API outputs before entering the model's working context
    to prevent context saturation and high token costs.
    Returns preview + total size + handle pointer for on-demand expansion.
    """
    if output is None:
        return {"content": "", "is_truncated": False}

    str_out = output if isinstance(output, str) else str(output)
    total_bytes = len(str_out.encode('utf-8'))
    lines = str_out.splitlines()
    total_lines = len(lines)

    if total_bytes <= max_bytes and total_lines <= max_lines:
        return {
            "content": str_out,
            "is_truncated": False,
            "total_bytes": total_bytes,
            "total_lines": total_lines
        }

    # Truncate to preview
    preview_lines = lines[:max_lines]
    preview_text = "\n".join(preview_lines)
    if len(preview_text.encode('utf-8')) > max_bytes:
        preview_text = preview_text[:max_bytes] + "... [truncated]"

    summary_note = (
        f"⚠️ [Tool Output Summarized: {total_lines} lines, {total_bytes} bytes total from '{tool_name}']\n"
        f"Showing preview ({len(preview_lines)} lines). Call 'inspect_tool_output_chunk' if you need additional lines/offsets.\n\n"
        f"{preview_text}\n\n"
        f"... [{total_lines - len(preview_lines)} more lines omitted. End of preview.]"
    )

    return {
        "content": summary_note,
        "is_truncated": True,
        "total_bytes": total_bytes,
        "total_lines": total_lines,
        "preview": preview_text,
        "raw_length": len(str_out)
    }
