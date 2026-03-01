
def build_coordinate_prompt(ocr_context: str, target_language: str) -> str:
    return (
        "You are given an image. "
        "Return strict JSON with keys exactly: Text Coordination, Context, Content, Langrage. "
        "For each sentence in Text Coordination, include bbox with x, y, w, h. "
        "Use pixel coordinates where 1 unit = 1 pixel. "
        "x is horizontal axis from the left edge, y is vertical axis from the top edge. "
        "w is width in pixels, h is height in pixels. "
        "x, y, w, h must be integers and must not be null. "
        "Estimate x, y, w, h from visual layout as precisely as possible.\n"
        "Text Coordination item format must be: "
        "{\"text\":\"...\",\"bbox\":{\"x\":123,\"y\":45,\"w\":300,\"h\":28}}.\n"
        "Do not output any keys other than Text Coordination, Context, Content, Langrage.\n\n"
        "OCR text for reference:\n"
        + ocr_context
        + "\n\nNow parse the IMAGE directly and provide coordinates.\n"
        + "Target language: "
        + target_language
    )
