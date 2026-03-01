import io
import base64
from typing import Dict, List, Optional, Tuple
import mss
from PIL import Image
from config import CAPTURE_MONITOR


class ScreenCapture:
    def __init__(self, monitor: int = CAPTURE_MONITOR):
        self.monitor = monitor
        self._sct: Optional[mss.mss] = None

    def set_monitor(self, index: int):
        """Switch which monitor to capture. Index 1+ = individual monitors."""
        self.monitor = index
        print(f"[Capture] Monitor set to {index}")

    @staticmethod
    def list_monitors() -> List[Dict[str, int]]:
        """Return list of available monitors with dimensions. Index 1+ = individual."""
        with mss.mss() as sct:
            return [
                {"index": i, "width": m["width"], "height": m["height"]}
                for i, m in enumerate(sct.monitors)
                if i > 0  # skip index 0 (virtual all-monitors bounding box)
            ]

    def grab_frame(self) -> Image.Image:
        """Grab a screenshot of the specified monitor. Call from thread pool."""
        if self._sct is None:
            self._sct = mss.mss()
        monitor = self._sct.monitors[self.monitor]
        sct_img = self._sct.grab(monitor)
        return Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")

    def frame_to_base64(
        self, img: Image.Image, max_size: Tuple[int, int] = (1280, 720)
    ) -> str:
        """Resize and base64-encode a frame for API calls."""
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=75)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
