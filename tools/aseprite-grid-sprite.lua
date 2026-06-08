--[[
  Auto-grid spritesheet:
  1. Detects individual sprites separated by transparent gaps
  2. Finds the largest sprite bounding box
  3. Uses that as cell size
  4. Centers each sprite in its cell
]]--

local spr = app.activeSprite
if not spr then return app.alert("No hay un sprite abierto") end

-- ── Flatten all visible layers into one image ──
local function flattenSprite(s)
  local img = Image(s.width, s.height)
  for i = #s.layers, 1, -1 do
    local layer = s.layers[i]
    if layer.isVisible then
      for _, cel in ipairs(layer.cels) do
        if cel.frameNumber == 1 then
          local celImg = cel.image
          local ox, oy = cel.position.x, cel.position.y
          for y = 0, celImg.height - 1 do
            for x = 0, celImg.width - 1 do
              local px = celImg:getPixel(x, y)
              local a = (px >> 24) & 0xff
              if a > 0 then
                img:drawPixel(ox + x, oy + y, px)
              end
            end
          end
        end
      end
    end
  end
  return img
end

local img = flattenSprite(spr)
local w, h = img.width, img.height

-- ── Helper: check if a pixel column is fully transparent ──
local function colEmpty(col)
  for y = 0, h - 1 do
    local px = img:getPixel(col, y)
    local a = (px >> 24) & 0xff
    if a > 0 then return false end
  end
  return true
end

-- ── Helper: check if a pixel row is fully transparent ──
local function rowEmpty(row)
  for x = 0, w - 1 do
    local px = img:getPixel(x, row)
    local a = (px >> 24) & 0xff
    if a > 0 then return false end
  end
  return true
end

-- ── Find sprite bounding boxes via transparent gaps ──
local splitsX = { 0 }
for x = 0, w - 1 do
  if colEmpty(x) then
    splitsX[#splitsX + 1] = x
  end
end
splitsX[#splitsX + 1] = w

local cols = {}
for i = 1, #splitsX - 1 do
  local x1 = splitsX[i]
  local x2 = splitsX[i + 1]
  local contentWidth = 0
  for x = x1, x2 do
    if not colEmpty(x) then contentWidth = contentWidth + 1 end
  end
  if contentWidth > 0 then
    cols[#cols + 1] = { x1 = x1, x2 = x2 }
  end
end

local sprites = {}
for _, c in ipairs(cols) do
  local splitsY = { 0 }
  for y = 0, h - 1 do
    local empty = true
    for x = c.x1, c.x2 do
      if x < w then
        local px = img:getPixel(x, y)
        local a = (px >> 24) & 0xff
        if a > 0 then empty = false; break end
      end
    end
    if empty then splitsY[#splitsY + 1] = y end
  end
  splitsY[#splitsY + 1] = h

  for i = 1, #splitsY - 1 do
    local y1 = splitsY[i]
    local y2 = splitsY[i + 1]
    local contentHeight = 0
    for y = y1, y2 do
      local empty = true
      for x = c.x1, c.x2 do
        if x < w then
          local px = img:getPixel(x, y)
          local a = (px >> 24) & 0xff
          if a > 0 then empty = false; break end
        end
      end
      if not empty then contentHeight = contentHeight + 1 end
    end
    if contentHeight > 0 then
      local sw = c.x2 - c.x1
      local sh = y2 - y1
      sprites[#sprites + 1] = { x = c.x1, y = y1, w = sw, h = sh }
    end
  end
end

if #sprites == 0 then
  return app.alert("No se detectaron sprites separados por pixeles transparentes.")
end

-- ── Find the largest sprite by dimensions ──
local cellW, cellH = 0, 0
for _, s in ipairs(sprites) do
  if s.w > cellW then cellW = s.w end
  if s.h > cellH then cellH = s.h end
end

-- ── Create output sprite ──
local colsOut = math.ceil(math.sqrt(#sprites))
local rowsOut = math.ceil(#sprites / colsOut)
app.command.NewFile{
  width = colsOut * cellW,
  height = rowsOut * cellH,
  colorMode = spr.colorMode,
  transparentColor = true,
  backgroundColor = app.bgColor,
}

local outSpr = app.activeSprite
local outImg = Image(outSpr.width, outSpr.height)

-- ── Place each sprite centered in its cell ──
for idx, s in ipairs(sprites) do
  local col = (idx - 1) % colsOut
  local row = math.floor((idx - 1) / colsOut)
  local cx = col * cellW + math.floor((cellW - s.w) / 2)
  local cy = row * cellH + math.floor((cellH - s.h) / 2)

  for y = 0, s.h - 1 do
    for x = 0, s.w - 1 do
      local px = img:getPixel(s.x + x, s.y + y)
      local a = (px >> 24) & 0xff
      if a > 0 then
        outImg:drawPixel(cx + x, cy + y, px)
      end
    end
  end
end

-- Paste into output sprite
local layer = outSpr.layers[1]
local cel = layer:cel(1)
if cel then cel.image = outImg else cel = outSpr:newCel(layer, 1); cel.image = outImg end
app.refresh()

app.alert(string.format("Hecho! %d sprites detectados. Celda: %dx%d", #sprites, cellW, cellH))
