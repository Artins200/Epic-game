--!strict
-- Эффекты порталов: сборка портала в рантайме, вспышки, ударные волны, звуки.
-- Соглашение: у деталей с дочерним StringValue "Swirl" значение = градусы/сек,
-- такие детали крутит клиентский скрипт WorldClient.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local Config = require(script.Parent:WaitForChild("Config"))

local Fx = {}

local SPARK = "rbxasset://textures/particles/sparkles_main.dds"
local SMOKE = "rbxasset://textures/particles/smoke_main.dds"
local FIRE = "rbxasset://textures/particles/fire_main.dds"
local IMPLODE = "rbxasset://textures/particles/explosion01_implosion_main.dds"

local function fxFolder(): Folder
	local folder = workspace:FindFirstChild("Effects")
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = "Effects"
		folder.Parent = workspace
	end
	return folder :: Folder
end

local function newPart(props): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in pairs(props) do
		(p :: any)[k] = v
	end
	return p
end

local function emitter(part: BasePart, props): ParticleEmitter
	local e = Instance.new("ParticleEmitter")
	if props.name then
		e.Name = props.name
	end
	e.Texture = props.texture or SPARK
	e.Rate = props.rate or 20
	e.Lifetime = props.lifetime or NumberRange.new(0.5, 1.4)
	e.Speed = props.speed or NumberRange.new(2, 8)
	e.Size = props.size or NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(1, 0) })
	e.Transparency = props.transparency or NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.2), NumberSequenceKeypoint.new(1, 1) })
	e.Color = props.color or ColorSequence.new(Color3.new(1, 1, 1))
	e.LightEmission = if props.lightEmission ~= nil then props.lightEmission else 1
	e.LightInfluence = if props.lightInfluence ~= nil then props.lightInfluence else 0
	e.SpreadAngle = props.spread or Vector2.new(30, 30)
	e.Acceleration = props.acceleration or Vector3.new(0, 0, 0)
	e.Rotation = props.rotation or NumberRange.new(0, 360)
	e.RotSpeed = props.rotSpeed or NumberRange.new(-120, 120)
	e.ZOffset = props.zOffset or 0
	e.LockedToPart = props.lockedToPart == true
	e.Parent = part
	return e
end

--- Проиграть звук в точке (сам удалится)
function Fx.playSound(cf: CFrame, soundId: string, volume: number?, pitch: number?, maxDist: number?)
	local folder = fxFolder()
	local anchor = newPart({ Size = Vector3.new(0.2, 0.2, 0.2), CFrame = cf, Color = Color3.new(1, 1, 1) })
	anchor.Transparency = 1
	anchor.Parent = folder
	local s = Instance.new("Sound")
	s.SoundId = soundId
	s.Volume = volume or 1
	s.PlaybackSpeed = pitch or 1
	s.RollOffMaxDistance = maxDist or 320
	s.RollOffMinDistance = 8
	s.RollOffMode = Enum.RollOffMode.InverseTapered
	s.Parent = anchor
	s:Play()
	Debris:AddItem(anchor, 8)
	return s
end

--- Яркая вспышка у дула портальной пушки
function Fx.muzzleFlash(cf: CFrame, paletteName: string, scale: number?)
	local pal = Config.palette(paletteName)
	local k = scale or 1
	local folder = fxFolder()
	local flash = newPart({
		Name = "MuzzleFlash",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(2.4 * k, 2.4 * k, 2.4 * k),
		CFrame = cf,
		Color = pal.core,
		Parent = folder,
	})
	local light = Instance.new("PointLight")
	light.Color = pal.light
	light.Range = 26 * k
	light.Brightness = 6
	light.Parent = flash
	emitter(flash, {
		rate = 180, lifetime = NumberRange.new(0.15, 0.4), speed = NumberRange.new(12, 34) * k,
		size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.4 * k), NumberSequenceKeypoint.new(1, 0) }),
		color = ColorSequence.new(pal.core, pal.deep), spread = Vector2.new(180, 180), acceleration = Vector3.new(0, -18, 0),
	})
	TweenService:Create(flash, TweenInfo.new(0.22, Enum.EasingStyle.Quad), {
		Size = Vector3.new(9 * k, 9 * k, 9 * k), Transparency = 1,
	}):Play()
	TweenService:Create(light, TweenInfo.new(0.22), { Brightness = 0, Range = 8 }):Play()
	Debris:AddItem(folder, 1.2)
	Fx.playSound(cf, Config.SOUNDS.shoot, 0.85, 1.5 + math.random() * 0.3, 260)
end

--- Луч от пушки до точки попадания
function Fx.tracer(from: Vector3, to: Vector3, paletteName: string)
	local pal = Config.palette(paletteName)
	local mid = (from + to) / 2
	local dir = (to - from)
	local length = dir.Magnitude
	local folder = fxFolder()
	local beam = newPart({
		Name = "Tracer",
		Size = Vector3.new(0.5, 0.5, length),
		CFrame = CFrame.lookAt(mid, to),
		Color = pal.mid,
		Parent = folder,
	})
	local light = Instance.new("PointLight")
	light.Color = pal.light
	light.Range = 20
	light.Brightness = 4
	light.Parent = beam
	TweenService:Create(beam, TweenInfo.new(0.28, Enum.EasingStyle.Quad), {
		Transparency = 1, Size = Vector3.new(0.1, 0.1, length),
	}):Play()
	Debris:AddItem(folder, 0.6)
end

--- Ударная волна (расширяющееся кольцо)
function Fx.shockwave(cf: CFrame, paletteName: string, radius: number?, thin: boolean?)
	local pal = Config.palette(paletteName)
	local r = radius or 14
	local folder = fxFolder()
	local ring = newPart({
		Name = "Shockwave",
		Shape = if thin == false then Enum.PartType.Ball else Enum.PartType.Cylinder,
		Size = Vector3.new(0.6, 4, 4),
		CFrame = cf,
		Color = pal.core,
		Transparency = 0.25,
		Parent = folder,
	})
	if thin == false then
		ring.Size = Vector3.new(4, 4, 4)
	else
	end
	local goalSize = if thin == false then Vector3.new(r * 2, r * 2, r * 2) else Vector3.new(1.2, r * 2, r * 2)
	TweenService:Create(ring, TweenInfo.new(0.55, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), {
		Size = goalSize, Transparency = 1,
	}):Play()
	Debris:AddItem(folder, 1)
end

--- Портальная «имплозия» + искры в точке будущего портала
function Fx.openBurst(cf: CFrame, paletteName: string, radius: number?)
	local pal = Config.palette(paletteName)
	local r = radius or 11
	local folder = fxFolder()
	local core = newPart({
		Name = "OpenBurst",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(r * 0.5, r * 0.5, r * 0.5),
		CFrame = cf,
		Color = pal.core,
		Parent = folder,
	})
	local light = Instance.new("PointLight")
	light.Color = pal.light
	light.Range = r * 5
	light.Brightness = 8
	light.Parent = core
	emitter(core, {
		texture = IMPLODE, rate = 120, lifetime = NumberRange.new(0.4, 1.1), speed = NumberRange.new(10, 26),
		size = NumberSequence.new({ NumberSequenceKeypoint.new(0, r * 0.35), NumberSequenceKeypoint.new(1, 0) }),
		color = ColorSequence.new(pal.core, pal.deep), spread = Vector2.new(180, 180),
	})
	emitter(core, {
		texture = SMOKE, rate = 40, lifetime = NumberRange.new(1.2, 2.6), speed = NumberRange.new(3, 9),
		size = NumberSequence.new({ NumberSequenceKeypoint.new(0, r * 0.3), NumberSequenceKeypoint.new(1, r * 1.5) }),
		transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 1) }),
		color = ColorSequence.new(pal.light, pal.deep), spread = Vector2.new(90, 90),
	})
	TweenService:Create(core, TweenInfo.new(0.45, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Size = Vector3.new(r * 2.1, r * 2.1, r * 2.1), Transparency = 1,
	}):Play()
	TweenService:Create(light, TweenInfo.new(0.5), { Brightness = 0, Range = r * 4 }):Play()
	Debris:AddItem(folder, 3.2)
	Fx.shockwave(cf, paletteName, r * 2.2)
	Fx.playSound(cf, Config.SOUNDS.open, 1, 1.15, 420)
end

--- Вспышка телепорта (на входе и на выходе)
function Fx.teleportBurst(cf: CFrame, paletteName: string, radius: number?)
	local pal = Config.palette(paletteName)
	local r = (radius or 11) * 0.9
	local folder = fxFolder()
	local ring = newPart({
		Name = "TeleportRing",
		Size = Vector3.new(0.6, r * 0.6, r * 0.6),
		CFrame = cf,
		Color = pal.core,
		Parent = folder,
		Shape = Enum.PartType.Cylinder,
	})
	emitter(ring, {
		rate = 90, lifetime = NumberRange.new(0.3, 0.9), speed = NumberRange.new(8, 20),
		size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.9), NumberSequenceKeypoint.new(1, 0) }),
		color = ColorSequence.new(pal.core, pal.deep), spread = Vector2.new(180, 180),
	})
	TweenService:Create(ring, TweenInfo.new(0.5, Enum.EasingStyle.Quint), {
		Size = Vector3.new(1, r * 2.4, r * 2.4), Transparency = 1,
	}):Play()
	Debris:AddItem(folder, 1.4)
	Fx.playSound(cf, Config.SOUNDS.teleport, 0.9, 0.85, 400)
end

--- Закрытие портала: сжатие + вспышка
function Fx.implode(portalModel: Model, paletteName: string, radius: number?)
	local pal = Config.palette(paletteName)
	local pivot = portalModel:GetPivot()
	Fx.openBurst(pivot, paletteName, (radius or 11) * 0.7)
	Fx.playSound(pivot, Config.SOUNDS.close, 0.9, 0.85, 320)
	for _, d in ipairs(portalModel:GetDescendants()) do
		if d:IsA("BasePart") then
			TweenService:Create(d, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.In), {
				Transparency = 1, Size = d.Size * 0.1,
			}):Play()
		elseif d:IsA("ParticleEmitter") then
			d.Enabled = false
		elseif d:IsA("PointLight") then
			d.Enabled = false
		end
	end
	Debris:AddItem(portalModel, 0.45)
end

--- Сборка портала в рантайме (для пушки и шоу персонажей).
-- cf: локальная +X — нормаль портала. Возвращает модель.
function Fx.buildPortal(parent: Instance, cf: CFrame, paletteName: string, radius: number?, name: string?): Model
	local pal = Config.palette(paletteName)
	local r = radius or 11
	local model = Instance.new("Model")
	model.Name = name or ("Portal_Runtime_" .. paletteName)

	local function add(part: BasePart, children)
		part.Parent = model
		if children then
			for _, c in ipairs(children) do
				c.Parent = part
			end
		end
		return part
	end

	-- светящийся зев
	local core = newPart({
		Name = "PortalCore", Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.22, r * 1.86, r * 1.86), CFrame = cf,
		Color = pal.mid, Transparency = 0.35, Parent = model,
	})
	local hole = newPart({
		Name = "PortalHole", Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.34, r * 1.3, r * 1.3), CFrame = cf * CFrame.new(0.06, 0, 0),
		Color = pal.deep, Transparency = 0.2, Parent = model,
	})
	local hot = newPart({
		Name = "PortalHot", Shape = Enum.PartType.Ball,
		Size = Vector3.new(r * 0.5, r * 0.5, r * 0.5), CFrame = cf * CFrame.new(0.1, 0, 0),
		Color = pal.core, Transparency = 0.4, Parent = model,
	})
	add(core)
	add(hole)
	add(hot)

	-- вращающиеся слои
	local layers = {
		{ ratio = 0.86, arcs = 2, span = 150, thick = 0.95, speed = 0.5 },
		{ ratio = 0.66, arcs = 3, span = 96, thick = 0.8, speed = -0.72 },
		{ ratio = 0.45, arcs = 2, span = 120, thick = 0.7, speed = 0.95 },
		{ ratio = 0.24, arcs = 3, span = 84, thick = 0.6, speed = -1.3 },
	}
	for _, layer in ipairs(layers) do
		for a = 0, layer.arcs - 1 do
			local startDeg = (a / layer.arcs) * 360 + 20
			local segs = math.max(5, math.floor((r * layer.ratio * layer.span) / 42))
			for i = 0, segs - 1 do
				local t = (i / segs) * layer.span
				local ang = math.rad(startDeg + t)
				local offset = CFrame.new(0, math.sin(ang) * r * layer.ratio, math.cos(ang) * r * layer.ratio)
				local frame = cf * offset * CFrame.Angles(-ang, 0, 0)
				local seg = newPart({
					Name = "PortalSwirl",
					Size = Vector3.new(r * layer.ratio * (layer.span / 360) * 1.05, layer.thick, r * 0.09),
					CFrame = frame,
					Color = pal.mid:Lerp(pal.core, layer.ratio),
					Transparency = 0.14,
					Parent = model,
				})
				local spin = Instance.new("StringValue")
				spin.Name = "Swirl"
				spin.Value = tostring(layer.speed)
				spin.Parent = seg
			end
		end
	end

	-- внешний обод
	local rimCount = math.max(16, math.floor(r * 1.6))
	for i = 0, rimCount - 1 do
		local ang = (i / rimCount) * math.pi * 2
		local frame = cf * CFrame.new(0, math.sin(ang) * r * 1.02, math.cos(ang) * r * 1.02) * CFrame.Angles(-ang, 0, 0)
		newPart({
			Name = "PortalRing",
			Size = Vector3.new(r * 0.17, r * 0.1, r * 0.13),
			CFrame = frame,
			Color = pal.core,
			Transparency = 0.06,
			Parent = model,
		})
	end

	-- свет и частицы
	local rig = newPart({
		Name = "PortalLightRig", Size = Vector3.new(0.6, 0.6, 0.6),
		CFrame = cf * CFrame.new(-r * 0.25, 0, 0), Color = pal.core, Parent = model,
	})
	local light = Instance.new("PointLight")
	light.Color = pal.light
	light.Range = r * 4.2
	light.Brightness = 3.4
	light.Shadows = true
	light.Parent = rig
	emitter(rig, {
		name = "PortalSparks", rate = 34, lifetime = NumberRange.new(0.5, 1.4), speed = NumberRange.new(6, 18),
		size = NumberSequence.new({ NumberSequenceKeypoint.new(0, r * 0.14), NumberSequenceKeypoint.new(1, 0) }),
		color = ColorSequence.new(pal.spark, pal.deep), rotSpeed = NumberRange.new(-200, 200),
		acceleration = Vector3.new(0, -6, 0), zOffset = 0.5, spread = Vector2.new(40, 40),
	})
	emitter(rig, {
		name = "PortalWisps", texture = SMOKE, rate = 12, lifetime = NumberRange.new(1.4, 3.2), speed = NumberRange.new(1, 5),
		size = NumberSequence.new({ NumberSequenceKeypoint.new(0, r * 0.2), NumberSequenceKeypoint.new(1, r * 0.62) }),
		transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.55), NumberSequenceKeypoint.new(1, 1) }),
		color = ColorSequence.new(pal.light, pal.deep), lightEmission = 0.85, lightInfluence = 0.1,
		spread = Vector2.new(60, 60), zOffset = -1,
	})

	-- триггер телепорта
	local trigger = newPart({
		Name = "PortalTrigger", Size = Vector3.new(3.2, r * 2.3, r * 2.3), CFrame = cf,
		Transparency = 1, CanTouch = true, Material = Enum.Material.SmoothPlastic, Parent = model,
	})

	local paletteValue = Instance.new("StringValue")
	paletteValue.Name = "Palette"
	paletteValue.Value = paletteName
	paletteValue.Parent = model
	local radiusValue = Instance.new("NumberValue")
	radiusValue.Name = "Radius"
	radiusValue.Value = r
	radiusValue.Parent = model

	model.PrimaryPart = core
	model.Parent = parent
	return model
end

return Fx
