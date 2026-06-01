-- GBA Color Quantizer 1.1
-- Convierte colores del sprite actual al formato BGR555 de Game Boy Advance
-- Cuantiza cada canal RGB de 8 bits a 5 bits (>> 3 << 3)
-- Funciona con sprites en modo RGB e Indexado
--
-- Instalación: copiar a la carpeta de scripts de Aseprite
--   Windows: %APPDATA%/Aseprite/scripts/
--   macOS: ~/Library/Application Support/Aseprite/scripts/
--   Linux: ~/.config/aseprite/scripts/
-- Luego: Archivo > Scripts > Rescan Scripts y aparecerá en el menú

local function gbaChannel(v)
  return (v >> 3) << 3
end

local function toGBA(c)
  return Color(gbaChannel(c.red), gbaChannel(c.green), gbaChannel(c.blue), c.alpha)
end

local function ditherChannel(v, error)
  local quantized = gbaChannel(v)
  local e = v - quantized
  return quantized, e
end

local dlg = Dialog("GBA BGR555")

dlg:check{
  id = "dither",
  label = "Dithering (Floyd-Steinberg)",
  text = "~",
  selected = false
}

dlg:separator{ id = "sep1" }

dlg:label{
  id = "info",
  label = "Info",
  text = "De 16.7M colores → 32.768 colores GBA"
}

dlg:button{
  id = "run",
  label = "Aplicar",
  focus = true,
  onclick = function()
    local sprite = app.activeSprite
    if not sprite then
      app.alert("No hay un sprite activo")
      return
    end

    local useDither = dlg.data.dither
    local isIndexed = sprite.colorMode == ColorMode.INDEXED

    app.transaction("GBA Quantize", function()
      if isIndexed then
        -- Cuantizar la paleta (colores indexados)
        local pal = sprite.palettes[1]
        for i = 0, pal.length - 1 do
          local c = pal:getColor(i)
          pal:setColor(i, toGBA(c))
        end
      else
        -- Cuantizar píxeles directos
        for i, layer in ipairs(sprite.layers) do
          for j, frame in ipairs(sprite.frames) do
            local cel = layer:cel(frame.frameNumber)
            if cel then
              local img = cel.image
              local w, h = img.width, img.height
              local err = {}

              for y = 0, h - 1 do
                for x = 0, w - 1 do
                  local c = img:getPixel(x, y)
                  local a = app.pixelColor.rgbaA(c)
                  if a > 0 then
                    local r = app.pixelColor.rgbaR(c)
                    local g = app.pixelColor.rgbaG(c)
                    local b = app.pixelColor.rgbaB(c)

                    local nr, ng, nb
                    if useDither then
                      local er, eg, eb
                      local idx = y * w + x

                      local pr = (err[idx] and err[idx].r or 0)
                      local pg = (err[idx] and err[idx].g or 0)
                      local pb = (err[idx] and err[idx].b or 0)

                      nr, er = ditherChannel(math.min(255, math.max(0, r + pr)))
                      ng, eg = ditherChannel(math.min(255, math.max(0, g + pg)))
                      nb, eb = ditherChannel(math.min(255, math.max(0, b + pb)))

                      -- Floyd-Steinberg: distribuir error a vecinos
                      local function addErr(ox, oy, dr, dg, db, factor)
                        local ni = (y + oy) * w + (x + ox)
                        err[ni] = {
                          r = (err[ni] and err[ni].r or 0) + dr * factor,
                          g = (err[ni] and err[ni].g or 0) + dg * factor,
                          b = (err[ni] and err[ni].b or 0) + db * factor,
                        }
                      end

                      addErr(1, 0, er, eg, eb, 7 / 16)
                      addErr(-1, 1, er, eg, eb, 3 / 16)
                      addErr(0, 1, er, eg, eb, 5 / 16)
                      addErr(1, 1, er, eg, eb, 1 / 16)
                    else
                      nr = gbaChannel(r)
                      ng = gbaChannel(g)
                      nb = gbaChannel(b)
                    end

                    img:drawPixel(x, y, app.pixelColor.rgba(nr, ng, nb, a))
                  end
                end
              end
            end
          end
        end
      end
    end)

    app.alert("Cuantización GBA aplicada" .. (useDither and " con dithering" or ""))
    dlg:close()
  end
}

dlg:button{
  id = "cancel",
  label = "Cancelar",
  onclick = function()
    dlg:close()
  end
}

dlg:show()
