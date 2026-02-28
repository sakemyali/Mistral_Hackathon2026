import io
import base64
from typing import Optional, Tuple
import mss
from PIL import Image
from config import CAPTURE_MONITOR


class ScreenCapture:
    def __init__(self, monitor: int = CAPTURE_MONITOR):
        self.monitor = monitor
        self._sct: Optional[mss.mss] = None

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
