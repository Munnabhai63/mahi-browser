"""
MAHI Browser - Official Brand Logo Assets Generator
Derives all official product branding assets from the approved master logo image:
1. Master preserved: 13_ASSETS/brand/mahi-browser-logo-master.png
2. Full Logo: 13_ASSETS/brand/mahi-browser-logo-horizontal.png (Transparent)
3. Full Logo Dark Mode: 13_ASSETS/brand/mahi-browser-logo-dark.png (White text, transparent)
4. Brand Mark: 13_ASSETS/brand/mahi-browser-mark.png (Dragon only, transparent)
5. Brand Mark Light: 13_ASSETS/brand/mahi-browser-mark-light.png
6. Brand Mark Dark: 13_ASSETS/brand/mahi-browser-mark-dark.png
7. Brand Mark Mono: 13_ASSETS/brand/mahi-browser-mark-mono.png (White silhouette on transparent)
8. App Icon: 13_ASSETS/brand/mahi-browser-icon.png (High-res squircle 512x512)
9. Windows multi-res ICO: 13_ASSETS/resources/icon.ico & 13_ASSETS/brand/mahi-browser.ico
10. Windows icon.png: 13_ASSETS/resources/icon.png
11. Web Favicons: favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png
12. Landing assets: landing/assets/img/favicon.ico, landing/assets/img/logo.png
13. Android mipmaps: ic_launcher, ic_launcher_round, ic_launcher_foreground, ic_notification
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageOps

MASTER_SRC = r'13_ASSETS/brand/mahi-browser-logo-master.png'
BRAND_DIR = r'13_ASSETS/brand'
RESOURCES_DIR = r'13_ASSETS/resources'
LANDING_IMG_DIR = r'landing/assets/img'
LANDING_PUBLIC_IMG_DIR = r'landing/public/assets/img'
ANDROID_RES_DIR = r'android/app/src/main/res'

def ensure_dirs():
    os.makedirs(BRAND_DIR, exist_ok=True)
    os.makedirs(RESOURCES_DIR, exist_ok=True)
    os.makedirs(LANDING_IMG_DIR, exist_ok=True)
    os.makedirs(LANDING_PUBLIC_IMG_DIR, exist_ok=True)
    for folder in ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi', 'drawable']:
        os.makedirs(os.path.join(ANDROID_RES_DIR, folder), exist_ok=True)

def remove_white_bg(img, is_text_included=True, shadow_cutoff_y=645):
    """
    Carefully isolates the dragon and text foreground onto a transparent alpha channel.
    Eliminates floor shadows and white presentation background while preserving
    anti-aliasing and specular highlights.
    """
    img = img.convert('RGBA')
    w, h = img.size
    pixels = img.load()

    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out_pixels = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, _ = pixels[x, y]
            color_diff = max(abs(r - g), abs(r - b), abs(g - b))

            # Floor shadow removal: if near the bottom and grey/low color diff, treat as background
            if y > shadow_cutoff_y and color_diff < 20:
                continue

            # Pure or near-white background
            if r > 242 and g > 242 and b > 242 and color_diff < 12:
                continue

            # Check if this pixel is inside the foreground
            # 1. Red dragon: high red saturation
            is_dragon = (r > 60 and (r - g) > 20 and (r - b) > 20) or (r > 120 and (r - min(g, b)) > 35)
            # 2. Specular highlight or interior detail inside dragon
            is_interior_highlight = (r > 200 and g > 180 and b > 180) and (color_diff < 30) and (y < 400 and x < 450)
            # 3. Text 'MAHI Browser'
            is_text = False
            if is_text_included and (x >= 280 and y >= 360 and y <= 560):
                # Dark letters (r,g,b < 180) or red accent in 'A'
                if (r < 180 and g < 180 and b < 180) or (r > 100 and (r - g) > 40):
                    is_text = True

            # If it's neutral grey on the outside (shadows/artifacts)
            if not is_dragon and not is_text and not is_interior_highlight:
                if color_diff < 15 and (r > 150 or y > 580):
                    continue

            # Compute anti-aliased alpha
            if is_dragon or is_interior_highlight:
                # For red foreground on white background:
                # background contribution is mostly in G and B
                bg_ratio = min(g, b) / 255.0
                alpha = int(max(0, min(255, (1.0 - bg_ratio) * 255.0 * 1.15)))
                if is_dragon and alpha < 40:
                    alpha = 0
                else:
                    # Un-premultiply slightly to preserve rich crimson vibrancy
                    if alpha > 0:
                        factor = 255.0 / max(alpha, 1)
                        nr = min(255, max(0, int((r - 255 * (1 - alpha/255.0)) * factor)))
                        ng = min(255, max(0, int((g - 255 * (1 - alpha/255.0)) * factor)))
                        nb = min(255, max(0, int((b - 255 * (1 - alpha/255.0)) * factor)))
                        out_pixels[x, y] = (nr, ng, nb, alpha)
                        continue
            elif is_text:
                # For black text on white background:
                luminance = (r * 0.299 + g * 0.587 + b * 0.114)
                alpha = int(max(0, min(255, (255.0 - luminance) * 1.1)))
                if alpha > 0:
                    out_pixels[x, y] = (r, g, b, alpha)
                    continue

            if color_diff > 15 and (r > 80 or not (r > 200 and g > 200 and b > 200)):
                out_pixels[x, y] = (r, g, b, 255)

    return out

def trim_transparent(img, padding=10):
    bbox = img.getbbox()
    if not bbox:
        return img
    x1, y1, x2, y2 = bbox
    w, h = img.size
    x1 = max(0, x1 - padding)
    y1 = max(0, y1 - padding)
    x2 = min(w, x2 + padding)
    y2 = min(h, y2 + padding)
    return img.crop((x1, y1, x2, y2))

def create_dark_mode_logo(full_logo_rgba):
    """
    Creates a variant of the full logo optimized for dark backgrounds:
    The dragon keeps its vibrant metallic crimson/ruby styling, while the dark text
    'MAHI Browser' is converted to crisp luminous white/light-slate for maximum readability.
    """
    out = full_logo_rgba.copy()
    w, h = out.size
    pixels = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # If dark text pixel (not the red dragon or red swoosh in 'A')
                color_diff = max(abs(r - g), abs(r - b), abs(g - b))
                if color_diff < 40 and r < 140:
                    # Invert to clean bright white/slate
                    val = 255 - r
                    pixels[x, y] = (val, val, val, a)
    return out

def create_monochrome_silhouette(img_rgba):
    """
    Generates a pure white silhouette on transparent alpha channel
    for Android notification icons and status bar compliance.
    """
    out = Image.new('RGBA', img_rgba.size, (0, 0, 0, 0))
    pixels_in = img_rgba.load()
    pixels_out = out.load()
    w, h = img_rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels_in[x, y]
            if a > 30:
                pixels_out[x, y] = (255, 255, 255, a)
    return out

def create_app_icon_squircle(dragon_mark_rgba, size=512):
    """
    Generates a premium square/squircle app icon with rich dark-red/crimson gradient
    background and the official dragon mark centered with a subtle drop shadow.
    """
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # Draw rounded squircle background
    radius = int(size * 0.22)
    # Gradient background: rich deep ruby red to crimson
    for i in range(size):
        # subtle vertical gradient from #b91c1c (185, 28, 28) to #7f1d1d (127, 29, 29)
        t = i / float(size)
        r = int(185 * (1 - t) + 120 * t)
        g = int(28 * (1 - t) + 18 * t)
        b = int(28 * (1 - t) + 18 * t)
        draw.line([(0, i), (size, i)], fill=(r, g, b, 255))

    # Mask to rounded rectangle
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    margin = int(size * 0.02)
    mask_draw.rounded_rectangle(
        [(margin, margin), (size - margin, size - margin)],
        radius=radius,
        fill=255
    )
    canvas.putalpha(mask)

    # Resize dragon mark to fit comfortably inside the squircle (safe zone 72%)
    inner_size = int(size * 0.76)
    dragon_resized = dragon_mark_rgba.copy()
    dragon_resized.thumbnail((inner_size, inner_size), Image.Resampling.LANCZOS)

    # Center position
    dx = (size - dragon_resized.width) // 2
    dy = (size - dragon_resized.height) // 2

    # Subtle inner glow / shadow behind mark
    canvas.alpha_composite(dragon_resized, (dx, dy))
    return canvas

def main():
    ensure_dirs()
    master = Image.open(MASTER_SRC).convert('RGB')
    print('Processing master logo:', master.size)

    # 1. Full Top Logo (Dragon + 'MAHI Browser' text)
    # Master crop around x: 165 to 935, y: 15 to 650
    full_crop = master.crop((165, 15, 935, 650))
    full_logo_trans = remove_white_bg(full_crop, is_text_included=True, shadow_cutoff_y=620)
    full_logo_trans = trim_transparent(full_logo_trans, padding=12)
    full_logo_path = os.path.join(BRAND_DIR, 'mahi-browser-logo-horizontal.png')
    full_logo_trans.save(full_logo_path, 'PNG')
    print('Saved:', full_logo_path, full_logo_trans.size)

    # 2. Full Top Logo Dark Mode (White text)
    dark_logo = create_dark_mode_logo(full_logo_trans)
    dark_logo_path = os.path.join(BRAND_DIR, 'mahi-browser-logo-dark.png')
    dark_logo.save(dark_logo_path, 'PNG')
    print('Saved:', dark_logo_path)

    # 3. Main Dragon Mark (Dragon only, no text)
    # In master, text is x in [465, 935], y in [380, 560]
    dragon_crop = master.crop((165, 15, 725, 650)).copy()
    # Mask out the text area so only the dragon body and tail remain
    for y in range(380 - 15, 560 - 15):
        for x in range(465 - 165, dragon_crop.width):
            dragon_crop.putpixel((x, y), (255, 255, 255))

    dragon_mark_trans = remove_white_bg(dragon_crop, is_text_included=False, shadow_cutoff_y=620)
    dragon_mark_trans = trim_transparent(dragon_mark_trans, padding=10)
    dragon_mark_path = os.path.join(BRAND_DIR, 'mahi-browser-mark.png')
    dragon_mark_trans.save(dragon_mark_path, 'PNG')
    print('Saved:', dragon_mark_path, dragon_mark_trans.size)

    # 4. Brand Mark Light and Dark variants
    mark_light_path = os.path.join(BRAND_DIR, 'mahi-browser-mark-light.png')
    dragon_mark_trans.save(mark_light_path, 'PNG')
    mark_dark_path = os.path.join(BRAND_DIR, 'mahi-browser-mark-dark.png')
    dragon_mark_trans.save(mark_dark_path, 'PNG')

    # 5. Monochrome Silhouette (Android notifications, high-contrast UI)
    mono_mark = create_monochrome_silhouette(dragon_mark_trans)
    mono_path = os.path.join(BRAND_DIR, 'mahi-browser-mark-mono.png')
    mono_mark.save(mono_path, 'PNG')
    print('Saved:', mono_path)

    # 6. App Icon (Square / Squircle 512x512)
    app_icon_512 = create_app_icon_squircle(dragon_mark_trans, size=512)
    app_icon_path = os.path.join(BRAND_DIR, 'mahi-browser-icon.png')
    app_icon_512.save(app_icon_path, 'PNG')
    print('Saved:', app_icon_path)

    # Copy to 13_ASSETS/resources/icon.png
    res_icon_png = os.path.join(RESOURCES_DIR, 'icon.png')
    app_icon_512.save(res_icon_png, 'PNG')
    print('Saved:', res_icon_png)

    # 7. Multi-resolution Windows ICO (16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    brand_ico = os.path.join(BRAND_DIR, 'mahi-browser.ico')
    res_ico = os.path.join(RESOURCES_DIR, 'icon.ico')
    app_icon_512.save(brand_ico, format='ICO', sizes=ico_sizes)
    app_icon_512.save(res_ico, format='ICO', sizes=ico_sizes)
    print('Saved multi-resolution Windows ICOs:', brand_ico, res_ico)

    # 8. Web Favicons
    # favicon.ico (16, 32, 48)
    favicon_ico_path = os.path.join(BRAND_DIR, 'favicon.ico')
    root_favicon_path = 'favicon.ico'
    landing_favicon_path = os.path.join(LANDING_IMG_DIR, 'favicon.ico')
    landing_pub_fav_path = os.path.join(LANDING_PUBLIC_IMG_DIR, 'favicon.ico')
    app_icon_512.save(favicon_ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    app_icon_512.save(root_favicon_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    app_icon_512.save(landing_favicon_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    app_icon_512.save(landing_pub_fav_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])

    # PNG favicons
    for size, name in [(16, 'favicon-16x16.png'), (32, 'favicon-32x32.png'), (180, 'apple-touch-icon.png')]:
        fav_png = app_icon_512.resize((size, size), Image.Resampling.LANCZOS)
        fav_png.save(os.path.join(BRAND_DIR, name), 'PNG')
        fav_png.save(name, 'PNG')

    # Landing page logo
    landing_logo_path = os.path.join(LANDING_IMG_DIR, 'mahi-browser-logo.png')
    full_logo_trans.save(landing_logo_path, 'PNG')
    landing_mark_path = os.path.join(LANDING_IMG_DIR, 'mahi-browser-mark.png')
    dragon_mark_trans.save(landing_mark_path, 'PNG')

    landing_pub_logo = os.path.join(LANDING_PUBLIC_IMG_DIR, 'mahi-browser-logo.png')
    full_logo_trans.save(landing_pub_logo, 'PNG')
    landing_pub_mark = os.path.join(LANDING_PUBLIC_IMG_DIR, 'mahi-browser-mark.png')
    dragon_mark_trans.save(landing_pub_mark, 'PNG')
    print('Saved web favicons and landing logos.')

    # 9. Android mipmap resources
    android_sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }

    # Circular mask for round icon
    def make_round(img):
        s = img.width
        mask = Image.new('L', (s, s), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, s, s), fill=255)
        res = img.copy()
        res.putalpha(mask)
        return res

    for folder, size in android_sizes.items():
        folder_path = os.path.join(ANDROID_RES_DIR, folder)
        # Standard launcher icon
        icon_res = app_icon_512.resize((size, size), Image.Resampling.LANCZOS)
        icon_res.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')

        # Round launcher icon
        round_res = make_round(icon_res)
        round_res.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')

        # Notification small icon (silhouette)
        notif_size = int(size * 0.5)
        notif_res = mono_mark.resize((notif_size, notif_size), Image.Resampling.LANCZOS)
        notif_canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        notif_canvas.alpha_composite(notif_res, ((size - notif_size) // 2, (size - notif_size) // 2))
        notif_canvas.save(os.path.join(folder_path, 'ic_notification.png'), 'PNG')

    # Adaptive icon foreground (108x108 with centered dragon mark inside 72dp safe zone)
    fg_108 = Image.new('RGBA', (108, 108), (0, 0, 0, 0))
    # Dragon mark resized to 66x66 (safe zone)
    dragon_fg = dragon_mark_trans.copy()
    dragon_fg.thumbnail((66, 66), Image.Resampling.LANCZOS)
    fg_108.alpha_composite(dragon_fg, ((108 - dragon_fg.width) // 2, (108 - dragon_fg.height) // 2))
    
    drawable_dir = os.path.join(ANDROID_RES_DIR, 'drawable')
    fg_108.save(os.path.join(drawable_dir, 'ic_launcher_foreground.png'), 'PNG')
    mono_mark.resize((48, 48), Image.Resampling.LANCZOS).save(os.path.join(drawable_dir, 'ic_notification.png'), 'PNG')

    # Adaptive icon XML definitions
    # ic_launcher.xml
    adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:color="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
'''
    round_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:color="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
'''
    anydpi_dir = os.path.join(ANDROID_RES_DIR, 'mipmap-anydpi-v26')
    os.makedirs(anydpi_dir, exist_ok=True)
    with open(os.path.join(anydpi_dir, 'ic_launcher.xml'), 'w', encoding='utf-8') as f:
        f.write(adaptive_xml)
    with open(os.path.join(anydpi_dir, 'ic_launcher_round.xml'), 'w', encoding='utf-8') as f:
        f.write(round_xml)

    print('Android launcher, adaptive, and notification icons created successfully.')

if __name__ == '__main__':
    main()
