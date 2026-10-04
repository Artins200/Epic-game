-- Мир: анимация порталов и «живых» групп, HUD, тряска камеры, реплики.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

local System = ReplicatedStorage:WaitForChild("PortalGunSystem")
local Config = require(System:WaitForChild("Config"))
local Remotes = System:WaitForChild("Remotes")
local PortalEvent = Remotes:WaitForChild("PortalEvent") :: RemoteEvent
local Talk = Remotes:WaitForChild("Talk") :: RemoteEvent

local RENDER_DISTANCE = 460
local GUI_DISTANCE = 900

-- ============================================================ HUD
local hud = nil
local dotGreen, dotYellow, zoneLabel, hintLabel

local function makeDot(parent, color, position)
	local dot = Instance.new("Frame")
	dot.Size = UDim2.fromOffset(18, 18)
	dot.Position = UDim2.new(0, 0, 0, position)
	dot.BackgroundColor3 = color
	dot.BackgroundTransparency = 0.65
	dot.BorderSizePixel = 0
	dot.Parent = parent
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(1, 0)
	corner.Parent = dot
	local stroke = Instance.new("UIStroke")
	stroke.Color = color
	stroke.Thickness = 2
	stroke.Transparency = 0.2
	stroke.Parent = dot
	return dot
end

local function buildHUD()
	local existing = player:FindFirstChild("PortalHUD")
	if existing then
		existing:Destroy()
	end
	local screen = Instance.new("ScreenGui")
	screen.Name = "PortalHUD"
	screen.ResetOnSpawn = false
	screen.IgnoreGuiInset = true
	screen.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	screen.Parent = player

	-- заголовок
	local titleCard = Instance.new("Frame")
	titleCard.Size = UDim2.new(0, 560, 0, 150)
	titleCard.Position = UDim2.new(0.5, 0, 0.16, 0)
	titleCard.AnchorPoint = Vector2.new(0.5, 0.5)
	titleCard.BackgroundColor3 = Color3.fromRGB(8, 10, 16)
	titleCard.BackgroundTransparency = 0.35
	titleCard.Parent = screen
	local c1 = Instance.new("UICorner")
	c1.CornerRadius = UDim.new(0, 14)
	c1.Parent = titleCard
	local stroke1 = Instance.new("UIStroke")
	stroke1.Color = Color3.fromRGB(70, 255, 150)
	stroke1.Thickness = 2
	stroke1.Parent = titleCard
	local t1 = Instance.new("TextLabel")
	t1.Text = "РИК И МОРТИ"
	t1.Size = UDim2.new(1, 0, 0.5, 0)
	t1.Position = UDim2.new(0, 0, 0, 10)
	t1.BackgroundTransparency = 1
	t1.TextColor3 = Color3.fromRGB(140, 255, 190)
	t1.TextScaled = true
	t1.Font = Enum.Font.SciFi
	t1.Parent = titleCard
	local t2 = Instance.new("TextLabel")
	t2.Text = "ПОРТАЛЬНАЯ СТАНЦИЯ 37-C · ЛКМ — зелёный портал, ПКМ — жёлтый"
	t2.Size = UDim2.new(1, -20, 0, 46)
	t2.Position = UDim2.new(0, 10, 0.5, 10)
	t2.BackgroundTransparency = 1
	t2.TextColor3 = Color3.fromRGB(220, 235, 255)
	t2.TextScaled = true
	t2.Font = Enum.Font.Code
	t2.Parent = titleCard
	task.delay(9, function()
		TweenService:Create(titleCard, TweenInfo.new(2), { BackgroundTransparency = 1 }):Play()
		TweenService:Create(t1, TweenInfo.new(2), { TextTransparency = 1 }):Play()
		TweenService:Create(t2, TweenInfo.new(2), { TextTransparency = 1 }):Play()
		TweenService:Create(stroke1, TweenInfo.new(2), { Transparency = 1 }):Play()
		task.delay(2.2, function()
			titleCard:Destroy()
		end)
	end)

	-- прицел
	local crosshair = Instance.new("Frame")
	crosshair.Name = "Crosshair"
	crosshair.Size = UDim2.fromOffset(26, 26)
	crosshair.Position = UDim2.new(0.5, 0, 0.5, 0)
	crosshair.AnchorPoint = Vector2.new(0.5, 0.5)
	crosshair.BackgroundTransparency = 1
	crosshair.Visible = false
	crosshair.Parent = screen
	for i = 1, 4 do
		local line = Instance.new("Frame")
		line.BackgroundColor3 = Color3.fromRGB(120, 255, 180)
		line.BorderSizePixel = 0
		line.Size = (i <= 2) and UDim2.fromOffset(2, 8) or UDim2.fromOffset(8, 2)
		if i == 1 then
			line.Position = UDim2.new(0.5, -1, 0, 0)
		elseif i == 2 then
			line.Position = UDim2.new(0.5, -1, 1, -8)
		elseif i == 3 then
			line.Position = UDim2.new(0, 0, 0.5, -1)
		else
			line.Position = UDim2.new(1, -8, 0.5, -1)
		end
		line.Parent = crosshair
	end
	local dot = Instance.new("Frame")
	dot.Size = UDim2.fromOffset(3, 3)
	dot.Position = UDim2.new(0.5, -1.5, 0.5, -1.5)
	dot.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	dot.BorderSizePixel = 0
	dot.Parent = crosshair

	-- панель порталов
	local panel = Instance.new("Frame")
	panel.Size = UDim2.fromOffset(190, 86)
	panel.Position = UDim2.new(0, 18, 0, 96)
	panel.BackgroundColor3 = Color3.fromRGB(10, 12, 20)
	panel.BackgroundTransparency = 0.4
	panel.Parent = screen
	local pc = Instance.new("UICorner")
	pc.CornerRadius = UDim.new(0, 10)
	pc.Parent = panel
	local ps = Instance.new("UIStroke")
	ps.Color = Color3.fromRGB(90, 120, 180)
	ps.Thickness = 1
	ps.Transparency = 0.4
	ps.Parent = panel
	local pt = Instance.new("TextLabel")
	pt.Text = "ПОРТАЛЫ"
	pt.Size = UDim2.new(1, -60, 0, 24)
	pt.Position = UDim2.new(0, 24, 0, 6)
	pt.BackgroundTransparency = 1
	pt.TextColor3 = Color3.fromRGB(200, 220, 255)
	pt.TextXAlignment = Enum.TextXAlignment.Left
	pt.TextScaled = true
	pt.Font = Enum.Font.Code
	pt.Parent = panel
	dotGreen = makeDot(panel, Color3.fromRGB(60, 235, 130), 36)
	dotYellow = makeDot(panel, Color3.fromRGB(255, 210, 50), 60)
	local gl = Instance.new("TextLabel")
	gl.Text = "зелёный (ЛКМ)"
	gl.Size = UDim2.new(1, -40, 0, 18)
	gl.Position = UDim2.new(0, 36, 0, 36)
	gl.BackgroundTransparency = 1
	gl.TextColor3 = Color3.fromRGB(180, 230, 200)
	gl.TextXAlignment = Enum.TextXAlignment.Left
	gl.TextScaled = true
	gl.Font = Enum.Font.Code
	gl.Parent = panel
	local yl = gl:Clone()
	yl.Text = "жёлтый (ПКМ)"
	yl.Position = UDim2.new(0, 36, 0, 60)
	yl.TextColor3 = Color3.fromRGB(240, 225, 160)
	yl.Parent = panel

	-- подсказки
	local controls = Instance.new("TextLabel")
	controls.Text = "WASD — идти · ПРОБЕЛ — прыжок · 1 — портальная пушка · E — поговорить"
	controls.Size = UDim2.new(0, 640, 0, 26)
	controls.Position = UDim2.new(0, 18, 1, -40)
	controls.BackgroundTransparency = 1
	controls.TextColor3 = Color3.fromRGB(190, 205, 235)
	controls.TextXAlignment = Enum.TextXAlignment.Left
	controls.TextScaled = true
	controls.Font = Enum.Font.Code
	controls.Parent = screen

	zoneLabel = Instance.new("TextLabel")
	zoneLabel.Text = ""
	zoneLabel.Size = UDim2.new(0, 520, 0, 40)
	zoneLabel.Position = UDim2.new(0.5, 0, 0.78, 0)
	zoneLabel.AnchorPoint = Vector2.new(0.5, 0.5)
	zoneLabel.BackgroundTransparency = 1
	zoneLabel.TextColor3 = Color3.fromRGB(140, 255, 200)
	zoneLabel.TextScaled = true
	zoneLabel.Font = Enum.Font.SciFi
	zoneLabel.TextStrokeTransparency = 0.4
	zoneLabel.Parent = screen

	-- вспышка на весь экран
	local flash = Instance.new("Frame")
	flash.Name = "Flash"
	flash.Size = UDim2.new(1, 0, 1, 0)
	flash.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	flash.BackgroundTransparency = 1
	flash.BorderSizePixel = 0
	flash.ZIndex = 3
	flash.Parent = screen

	hud = { screen = screen, crosshair = crosshair, flash = flash }
	return hud
end

buildHUD()

-- прицел виден, когда экипирована портальная пушка
local function watchTools()
	local char = player.Character
	if not char then
		return
	end
	local function update()
		local equippedGun = char:FindFirstChild("Portal Gun") ~= nil
		if hud then
			hud.crosshair.Visible = equippedGun
		end
	end
	char.ChildAdded:Connect(function(c)
		if c.Name == "Portal Gun" then
			update()
		end
	end)
	char.ChildRemoved:Connect(function(c)
		if c.Name == "Portal Gun" then
			task.wait(0.1)
			update()
		end
	end)
	update()
end

player.CharacterAdded:Connect(function()
	task.wait(0.3)
	watchTools()
	if hud then
		hud.crosshair.Visible = false
	end
end)
watchTools()

-- ============================================================ эффектная тряска и вспышки
local flashTween = nil
local function screenFlash(color: Color3, power: number)
	if not hud then
		return
	end
	hud.flash.BackgroundColor3 = color
	hud.flash.BackgroundTransparency = 0.55
	if flashTween then
		flashTween:Cancel()
	end
	flashTween = TweenService:Create(hud.flash, TweenInfo.new(0.45 * (power or 1), Enum.EasingStyle.Quad), { BackgroundTransparency = 1 })
	flashTween:Play()
end

local shakeUntil = 0
local shakePower = 0
local shakeConn = RunService:BindToRenderStep("PortalShake", Enum.RenderPriority.Camera.Value + 2, function()
	if os.clock() > shakeUntil then
		return
	end
	local left = (shakeUntil - os.clock()) / 0.5
	local p = math.max(0, math.min(1, left)) * shakePower
	camera.CFrame = camera.CFrame * CFrame.Angles(math.rad((math.random() - 0.5) * 2.6 * p), math.rad((math.random() - 0.5) * 2.6 * p), math.rad((math.random() - 0.5) * 2.2 * p))
end)

local function shake(power: number, duration: number?)
	shakePower = power
	shakeUntil = os.clock() + (duration or 0.5)
end

-- ============================================================ реплики персонажей
local function showSpeech(head: BasePart, text: string, duration: number)
	local billboard = Instance.new("BillboardGui")
	billboard.Name = "Speech"
	billboard.Size = UDim2.fromOffset(300, 90)
	billboard.StudsOffsetWorldSpace = Vector3.new(0, 3.6, 0)
	billboard.AlwaysOnTop = true
	billboard.MaxDistance = 220
	billboard.Parent = head

	local bubble = Instance.new("Frame")
	bubble.Size = UDim2.new(1, 0, 1, 0)
	bubble.BackgroundColor3 = Color3.fromRGB(12, 14, 22)
	bubble.BackgroundTransparency = 0.15
	bubble.BorderSizePixel = 0
	bubble.Parent = billboard
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = bubble
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(120, 255, 180)
	stroke.Thickness = 1.5
	stroke.Transparency = 0.2
	stroke.Parent = bubble
	local label = Instance.new("TextLabel")
	label.Text = text
	label.Size = UDim2.new(1, -18, 1, -14)
	label.Position = UDim2.new(0, 9, 0, 7)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(235, 245, 255)
	label.TextWrapped = true
	label.TextScaled = true
	label.Font = Enum.Font.Code
	label.Parent = bubble

	billboard.Size = UDim2.fromOffset(300, 0)
	TweenService:Create(billboard, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Size = UDim2.fromOffset(300, 90) }):Play()
	task.delay(duration, function()
		local t = TweenService:Create(billboard, TweenInfo.new(0.4), { Size = UDim2.fromOffset(300, 0) })
		t:Play()
		t.Completed:Wait()
		billboard:Destroy()
	end)
end

Talk.OnClientEvent:Connect(function(head, text, duration)
	if head and head:IsA("BasePart") and typeof(text) == "string" then
		showSpeech(head, text, duration or 5)
	end
end)

PortalEvent.OnClientEvent:Connect(function(action, position, paletteName, power)
	if action == "shake" then
		shake(power or 0.6, 0.5)
	elseif action == "flash" then
		local pal = Config.palette(paletteName)
		screenFlash(pal.mid, power or 0.6)
	elseif action == "teleport" then
		local pal = Config.palette(paletteName)
		screenFlash(pal.core, 0.9)
		shake(0.5, 0.35)
		local sound = Config.SOUNDS.teleport
		local s = Instance.new("Sound")
		s.SoundId = sound
		s.Volume = 0.6
		s.PlaybackSpeed = 0.9 + math.random() * 0.2
		s.Parent = camera
		s:Play()
		game:GetService("Debris"):AddItem(s, 4)
	end
end)

-- отметки порталов игрока (свои — ярче)
PortalEvent.OnClientEvent:Connect(function(action, userId, kind, active)
	if action == "status" and typeof(userId) == "number" and typeof(kind) == "string" then
		if userId == player.UserId then
			local dot = (kind == "green") and dotGreen or dotYellow
			if dot then
				TweenService:Create(dot, TweenInfo.new(0.25), { BackgroundTransparency = active and 0.05 or 0.75 }):Play()
			end
		end
	end
end)

-- ============================================================ анимация порталов
local portals = {}
local portalByModel = {}

local function collectPortals()
	for _, d in ipairs(workspace:GetDescendants()) do
		if d:IsA("Model") and string.sub(d.Name, 1, 7) == "Portal_" and not portalByModel[d] then
			local trigger = d:FindFirstChild("PortalTrigger")
			if trigger and trigger:IsA("BasePart") then
				local swirls = {}
				for _, part in ipairs(d:GetDescendants()) do
					if part:IsA("BasePart") then
						local swirl = part:FindFirstChild("Swirl")
						if swirl and swirl:IsA("StringValue") then
							table.insert(swirls, {
								part = part,
								speed = tonumber(swirl.Value) or 0.5,
								localCF = trigger.CFrame:Inverse() * part.CFrame,
							})
						end
					end
				end
				local core = d:FindFirstChild("PortalCore")
				local hot = d:FindFirstChild("PortalHot")
				local lightRig = d:FindFirstChild("PortalLightRig")
				local entry = {
					model = d,
					trigger = trigger,
					swirls = swirls,
					core = core,
					hot = hot,
					hotBase = hot and hot.Size or Vector3.new(5.5, 5.5, 5.5),
					light = (lightRig and lightRig:FindFirstChildOfClass("PointLight")) or nil,
					phase = math.random() * 6.28,
				}
				portalByModel[d] = entry
				table.insert(portals, entry)
			end
		end
	end
end

local function refreshPortals()
	for i = #portals, 1, -1 do
		local entry = portals[i]
		if not entry.model.Parent or not entry.trigger.Parent then
			portalByModel[entry.model] = nil
			table.remove(portals, i)
		end
	end
	collectPortals()
end

collectPortals()
task.spawn(function()
	while true do
		task.wait(4)
		refreshPortals()
	end
end)
workspace:WaitForChild("LivePortals").ChildAdded:Connect(function()
	task.wait(0.1)
	refreshPortals()
end)

-- ============================================================ «живые» группы мира
local spins, pulses, bobs, orbits = {}, {}, {}, {}
local groupSeen = {}

local function collectGroups()
	for _, d in ipairs(workspace:GetDescendants()) do
		if groupSeen[d] then
			continue
		end
		groupSeen[d] = true
		local cfg = d:FindFirstChild("SpinGroup")
		if cfg and (d:IsA("Model") or d:IsA("BasePart")) then
			local speed = cfg:FindFirstChild("Speed")
			local axis = cfg:FindFirstChild("Axis")
			local pivot = (d:IsA("Model") and d.PrimaryPart) or (d:IsA("BasePart") and d) or nil
			if speed and pivot then
				table.insert(spins, {
					model = d, pivot = pivot,
					speed = (speed :: NumberValue).Value,
					axis = axis and (axis :: Vector3Value).Value or Vector3.new(0, 1, 0),
					base = pivot.CFrame,
					parts = (function()
						local list = {}
						local targets = d:IsA("Model") and d:GetDescendants() or { d }
						for _, p in ipairs(targets) do
							if p:IsA("BasePart") and p ~= pivot then
								table.insert(list, { part = p, localCF = pivot.CFrame:Inverse() * p.CFrame })
							end
						end
						return list
					end)(),
				})
			end
		end
		local pulse = d:FindFirstChild("PulseGroup")
		if pulse and d:IsA("BasePart") then
			local speed = pulse:FindFirstChild("Speed")
			local minT = pulse:FindFirstChild("MinTransparency")
			local maxT = pulse:FindFirstChild("MaxTransparency")
			local scale = pulse:FindFirstChild("Scale")
			table.insert(pulses, {
				part = d,
				speed = speed and (speed :: NumberValue).Value or 1,
				minT = minT and (minT :: NumberValue).Value or 0.2,
				maxT = maxT and (maxT :: NumberValue).Value or 0.6,
				scale = scale and (scale :: NumberValue).Value or 1,
				baseSize = d.Size,
				baseT = d.Transparency,
				phase = math.random() * 6.28,
			})
		end
		local bob = d:FindFirstChild("BobGroup")
		if bob and (d:IsA("BasePart") or d:IsA("Model")) then
			local speed = bob:FindFirstChild("Speed")
			local amp = bob:FindFirstChild("Amplitude")
			local pivot = (d:IsA("Model") and d.PrimaryPart) or (d:IsA("BasePart") and d) or nil
			if pivot then
				table.insert(bobs, {
					model = d, pivot = pivot,
					speed = speed and (speed :: NumberValue).Value or 1,
					amp = amp and (amp :: NumberValue).Value or 2,
					base = pivot.CFrame,
					parts = (function()
						local list = {}
						local targets = d:IsA("Model") and d:GetDescendants() or { d }
						for _, p in ipairs(targets) do
							if p:IsA("BasePart") and p ~= pivot then
								table.insert(list, { part = p, localCF = pivot.CFrame:Inverse() * p.CFrame })
							end
						end
						return list
					end)(),
					phase = math.random() * 6.28,
				})
			end
		end
		local orbit = d:FindFirstChild("OrbitGroup")
		if orbit and (d:IsA("Model") or d:IsA("BasePart")) then
			local function num(n)
				local v = orbit:FindFirstChild(n)
				return v and (v :: NumberValue).Value or 0
			end
			local pivot = (d:IsA("Model") and d.PrimaryPart) or (d:IsA("BasePart") and d) or nil
			if pivot then
				table.insert(orbits, {
					model = d, pivot = pivot,
					center = Vector3.new(num("CenterX"), num("CenterY"), num("CenterZ")),
					radius = num("Radius"), speed = num("Speed"),
					angle = math.rad(num("StartAngle")),
					rotation = pivot.CFrame.Rotation,
					parts = (function()
						local list = {}
						local targets = d:IsA("Model") and d:GetDescendants() or { d }
						for _, p in ipairs(targets) do
							if p:IsA("BasePart") and p ~= pivot then
								table.insert(list, { part = p, localCF = pivot.CFrame:Inverse() * p.CFrame })
							end
						end
						return list
					end)(),
				})
			end
		end
	end
end

collectGroups()
task.delay(3, collectGroups)

-- ============================================================ главный цикл анимации
local t = 0
RunService.Heartbeat:Connect(function(dt)
	t += dt
	local camPos = camera.CFrame.Position

	-- порталы
	for _, p in ipairs(portals) do
		local pos = p.trigger.Position
		if (pos - camPos).Magnitude < RENDER_DISTANCE then
			local base = p.trigger.CFrame
			local angle = t * 1.6 + p.phase
			for _, s in ipairs(p.swirls) do
				s.part.CFrame = base * CFrame.Angles(angle * s.speed, 0, 0) * s.localCF
			end
			if p.core then
				p.core.Transparency = 0.3 + math.sin(t * 3 + p.phase) * 0.09
			end
			if p.hot and p.hotBase then
				local s = 1 + math.sin(t * 4.2 + p.phase) * 0.14
				p.hot.Size = p.hotBase * s
			end
			if p.light then
				p.light.Brightness = 3.2 + math.sin(t * 6 + p.phase) * 1.1
			end
		end
	end

	-- вращение
	for _, s in ipairs(spins) do
		if (s.base.Position - camPos).Magnitude < GUI_DISTANCE then
			local angle = math.rad(t * s.speed)
			local rot = CFrame.fromAxisAngle(s.axis.Unit, angle)
			for _, item in ipairs(s.parts) do
				item.part.CFrame = s.base * rot * item.localCF
			end
		end
	end

	-- пульсация
	for _, p in ipairs(pulses) do
		local k = (math.sin(t * p.speed + p.phase) + 1) * 0.5
		p.part.Transparency = p.minT + (p.maxT - p.minT) * k
		if p.scale ~= 1 and p.scale > 0 then
			local s = 1 + (p.scale - 1) * k
			p.part.Size = p.baseSize * s
		end
	end

	-- покачивание
	for _, b in ipairs(bobs) do
		local y = math.sin(t * b.speed + b.phase) * b.amp
		local shift = CFrame.new(0, y, 0)
		for _, item in ipairs(b.parts) do
			item.part.CFrame = b.base * shift * item.localCF
		end
	end

	-- орбиты (тарелки)
	for _, o in ipairs(orbits) do
		o.angle += math.rad(o.speed * dt)
		local pos = o.center + Vector3.new(math.cos(o.angle) * o.radius, 0, math.sin(o.angle) * o.radius)
		local cf = CFrame.new(pos) * o.rotation * CFrame.Angles(0, -o.angle, 0)
		for _, item in ipairs(o.parts) do
			item.part.CFrame = cf * item.localCF
		end
	end
end)

-- ============================================================ зоны: подпись рядом с порталом-хабом
task.spawn(function()
	while true do
		task.wait(0.4)
		local char = player.Character
		local hrp = char and char:FindFirstChild("HumanoidRootPart")
		local text = ""
		if hrp then
			for name, label in pairs(Config.ZONE_LABELS) do
				local model = workspace:FindFirstChild(name, true)
				if model then
					local trigger = model:FindFirstChild("PortalTrigger")
					if trigger and trigger:IsA("BasePart") and (trigger.Position - hrp.Position).Magnitude < 34 then
						text = label .. " · шагни в портал"
					end
				end
			end
		end
		if zoneLabel and zoneLabel.Text ~= text then
			zoneLabel.Text = text
		end
	end
end)

-- ============================================================ гул порталов (эмбиент)
local function ambientHum(position: Vector3, speed: number, volume: number, distance: number)
	local anchor = Instance.new("Part")
	anchor.Name = "AmbientHum"
	anchor.Size = Vector3.new(0.5, 0.5, 0.5)
	anchor.Position = position
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Transparency = 1
	anchor.Parent = workspace
	local s = Instance.new("Sound")
	s.SoundId = Config.SOUNDS.open
	s.Looped = true
	s.Volume = volume
	s.PlaybackSpeed = speed
	s.RollOffMaxDistance = distance
	s.RollOffMinDistance = 20
	s.RollOffMode = Enum.RollOffMode.InverseTapered
	s.Parent = anchor
	s:Play()
end

ambientHum(Vector3.new(0, 8, 0), 0.12, 0.5, 220)
ambientHum(Vector3.new(0, -60, -20), 0.1, 0.4, 160)
ambientHum(Vector3.new(-380, 10, 0), 0.09, 0.35, 200)
ambientHum(Vector3.new(380, 10, 0), 0.13, 0.35, 200)
ambientHum(Vector3.new(0, 14, -380), 0.11, 0.35, 200)
