import io
import base64
from typing import Dict, Optional, Tuple
import mss
from PIL import Image
from config import CAPTURE_MONITOR


class ScreenCapture:
    def __init__(self, monitor: int = CAPTURE_MONITOR):
        self.monitor = monitor
        self._sct: Optional[mss.mss] = None
        self._capture_region: Optional[Dict[str, int]] = None

    def set_capture_region(self, region: Optional[Dict[str, int]]):
        """Set a sub-region to capture. None = full monitor."""
        self._capture_region = region
        if region:
            print(f"[Capture] Region set: {region['width']}x{region['height']} at ({region['x']},{region['y']})")
        else:
            print("[Capture] Region cleared — full monitor")

    def grab_frame(self) -> Image.Image:
        """Grab a screenshot of the specified monitor (or sub-region). Call from thread pool."""
        if self._sct is None:
            self._sct = mss.mss()
        monitor = self._sct.monitors[self.monitor]
        sct_img = self._sct.grab(monitor)
        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")

        # Crop to region if set
        if self._capture_region:
            r = self._capture_region
            x, y, w, h = r["x"], r["y"], r["width"], r["height"]
            # Clamp to image bounds
            x2 = min(x + w, img.width)
            y2 = min(y + h, img.height)
            x = max(0, x)
            y = max(0, y)
            if x2 > x and y2 > y:
                img = img.crop((x, y, x2, y2))

        return img

    def frame_to_base64(
        self, img: Image.Image, max_size: Tuple[int, int] = (1280, 720)
    ) -> str:
        """Resize and base64-encode a frame for API calls."""
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=75)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
