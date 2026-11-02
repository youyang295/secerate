# -*- coding: utf-8 -*-
"""生成密码箱的图标（渐变圆角底 + 白色挂锁）。

运行：python make-icons.py
产出：icon-192.png / icon-512.png / icon-maskable-512.png
"""

import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))

S = 1024  # 先画大图再缩，边缘更干净

GRAD_TOP = (99, 127, 255)     # #637fff
GRAD_BOTTOM = (56, 84, 235)   # #3854eb


def gradient(size):
    """对角线性渐变"""
    img = Image.new('RGB', (size, size))
    px = img.load()
    top, bottom = GRAD_TOP, GRAD_BOTTOM
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = (
                round(top[0] + (bottom[0] - top[0]) * t),
                round(top[1] + (bottom[1] - top[1]) * t),
                round(top[2] + (bottom[2] - top[2]) * t),
            )
    return img


def rounded_mask(size, radius, inset=0):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle(
        [inset, inset, size - 1 - inset, size - 1 - inset], radius=radius, fill=255
    )
    return mask


def draw_lock(layer_size, scale=1.0):
    """在透明层上画白色挂锁，scale 控制大小（1.0 时按 1024 画布设计）"""
    layer = Image.new('RGBA', (layer_size, layer_size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def sx(v):
        """把 1024 设计坐标换算到当前层"""
        return (v - 512) * scale + layer_size / 2

    def sy(v):
        return (v - 512) * scale + layer_size / 2

    white = (255, 255, 255, 255)

    # 锁梁：上半圆弧
    arc_w = max(2, round(74 * scale))
    d.arc(
        [sx(336), sy(226), sx(688), sy(600)],
        start=180,
        end=360,
        fill=white,
        width=arc_w,
    )

    # 锁体
    d.rounded_rectangle(
        [sx(288), sy(452), sx(736), sy(806)],
        radius=round(76 * scale),
        fill=white,
    )

    # 钥匙孔：圆 + 竖槽
    hole = (44, 140, 255, 255)  # 用底色画出镂空感
    d.ellipse(
        [sx(468), sy(556), sx(556), sy(644)],
        fill=hole,
    )
    d.polygon(
        [
            (sx(486), sy(628)),
            (sx(538), sy(628)),
            (sx(528), sy(716)),
            (sx(496), sy(716)),
        ],
        fill=hole,
    )

    return layer


def build(size, radius, icon_scale, inset, out_name):
    base = gradient(S).convert('RGBA')
    base.putalpha(rounded_mask(S, radius))

    if inset:
        base = Image.composite(
            base,
            Image.new('RGBA', (S, S), (0, 0, 0, 0)),
            rounded_mask(S, radius, inset),
        )

    lock_size = S
    lock = draw_lock(lock_size, icon_scale * (0.78 if inset else 1.0))
    base.alpha_composite(lock)

    img = base.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(HERE, out_name))
    print('wrote', out_name, img.size)


if __name__ == '__main__':
    # 普通图标：圆角 ~22%
    build(512, 224, 0.78, 0, 'icon-512.png')
    build(192, 84, 0.78, 0, 'icon-192.png')
    # maskable：图形缩到安全区（80%），四边留白
    build(512, 224, 0.95, 60, 'icon-maskable-512.png')
