-- Портал-сервер: порталы игроков, телепорт, шоу персонажей, диалоги.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local System = ReplicatedStorage:WaitForChild("PortalGunSystem")
local Config = require(System:WaitForChild("Config"))
local Fx = require(System:WaitForChild("Fx"))
local RigAnim = require(System:WaitForChild("RigAnim"))

local Remotes = System:WaitForChild("Remotes")
local FirePortal = Remotes:WaitForChild("FirePortal") :: RemoteEvent
local PortalEvent = Remotes:WaitForChild("PortalEvent") :: RemoteEvent
local Talk = Remotes:WaitForChild("Talk") :: RemoteEvent

local livePortals = workspace:WaitForChild("LivePortals") :: Folder
local world = workspace:WaitForChild("World") :: Folder

local TELEPORT_COOLDOWN = 1.1
local teleportCooldown: { [Model]: number } = {}
local portalCooldown: { [Player]: number } = {}
local playerPortals: { [Player]: { [string]: any } } = {}

-- ============================================================ утилиты
local function now(): number
	return os.clock()
end

local function burstAt(cf: CFrame, palette: string, radius: number?)
	Fx.teleportBurst(cf, palette, radius)
	PortalEvent:FireAllClients("flash", cf.Position, palette, 0.6)
end

local function normalOf(cf: CFrame): Vector3
	return cf:VectorToWorldSpace(Vector3.new(1, 0, 0))
end

--- Регистрация портала: телепорт при касании
local function registerPortal(model: Model)
	local trigger = model:FindFirstChild("PortalTrigger")
	local paletteValue = model:FindFirstChild("Palette")
	local radiusValue = model:FindFirstChild("Radius")
	if not trigger or not trigger:IsA("BasePart") then
		return nil
	end
	local record = {
		model = model,
		trigger = trigger,
		cf = trigger.CFrame,
		palette = paletteValue and (paletteValue :: StringValue).Value or "green",
		radius = radiusValue and (radiusValue :: NumberValue).Value or 11,
		exit = nil,
	}
	trigger.Touched:Connect(function(hit)
		local character = hit:FindFirstAncestorOfClass("Model")
		if not character or not character:FindFirstChild("HumanoidRootPart") or not character:FindFirstChildOfClass("Humanoid") then
			return
		end
		local last = teleportCooldown[character]
		if last and now() - last < TELEPORT_COOLDOWN then
			return
		end
		local target = record.exit
		if not target then
			return
		end
		teleportCooldown[character] = now()
		local hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart
		local exitCF = target.cf
		local dir = normalOf(exitCF)
		local dest = exitCF.Position + dir * (target.radius + 4)
		burstAt(record.cf * CFrame.new(0, 0, 0), record.palette, record.radius)
		character:PivotTo(CFrame.lookAt(dest, dest + dir))
		hrp.AssemblyLinearVelocity = dir * 44 + Vector3.new(0, 8, 0)
		burstAt(exitCF, target.palette, target.radius)
		local player = Players:GetPlayerFromCharacter(character)
		if player then
			PortalEvent:FireAllClients("teleport", dest, target.palette, 1)
		end
	end)
	return record
end

--- Связать два портала (выход друг в друга)
local function linkPortals(a, b)
	if not a or not b then
		return
	end
	a.exit = b
	b.exit = a
end

-- ============================================================ статичные порталы мира
local staticPortals: { [string]: any } = {}

local function setupStaticPortals()
	for _, d in ipairs(world:GetDescendants()) do
		if d:IsA("Model") and string.sub(d.Name, 1, 7) == "Portal_" then
			local rec = registerPortal(d)
			if rec then
				staticPortals[d.Name] = rec
			end
		end
	end
	-- связываем по LinkTo
	for name, rec in pairs(staticPortals) do
		local link = rec.model:FindFirstChild("LinkTo")
		if link and link:IsA("StringValue") then
			local other = staticPortals[link.Value]
			if other then
				linkPortals(rec, other)
			end
		end
	end
end

-- ============================================================ порталы игроков
local function killPortal(player: Player, kind: string, silent: boolean?)
	local state = playerPortals[player]
	if not state or not state[kind] then
		return
	end
	local rec = state[kind]
	state[kind] = nil
	if rec.exit and rec.exit.exit == rec then
		rec.exit.exit = nil
	end
	rec.exit = nil
	if rec.model and rec.model.Parent then
		if silent then
			rec.model:Destroy()
		else
			Fx.implode(rec.model, rec.palette, rec.radius)
		end
	end
	PortalEvent:FireAllClients("status", player.UserId, kind, false)
end

local function spawnPlayerPortal(player: Player, kind: string, position: Vector3, normal: Vector3)
	local pal = (kind == "yellow") and "yellow" or "green"
	local cf = Config.portalCF(position, normal)
	local radius = Config.GUN.portalRadius
	local model = Fx.buildPortal(livePortals, cf, pal, radius, "Portal_Player_" .. player.Name .. "_" .. kind)
	local rec = registerPortal(model)
	if not rec then
		model:Destroy()
		return
	end
	rec.owner = player
	rec.kind = kind
	playerPortals[player][kind] = rec
	-- связать с другим порталом игрока
	local otherKind = (kind == "green") and "yellow" or "green"
	local other = playerPortals[player][otherKind]
	if other then
		linkPortals(rec, other)
	else
		rec.exit = nil
	end
	Fx.openBurst(cf, pal, radius)
	PortalEvent:FireAllClients("shake", position, 0.85)
	PortalEvent:FireAllClients("status", player.UserId, kind, true)
end

FirePortal.OnServerEvent:Connect(function(player, kind, position, normal)
	if typeof(kind) ~= "string" or typeof(position) ~= "Vector3" or typeof(normal) ~= "Vector3" then
		return
	end
	if kind ~= "green" and kind ~= "yellow" then
		return
	end
	if normal.Magnitude < 0.5 then
		return
	end
	normal = normal.Unit
	local last = portalCooldown[player] or 0
	if now() - last < Config.GUN.cooldown then
		return
	end
	local character = player.Character
	local hrp = character and character:FindFirstChild("HumanoidRootPart")
	if not hrp or not character:FindFirstChildOfClass("Humanoid") then
		return
	end
	local hum = character:FindFirstChildOfClass("Humanoid") :: Humanoid
	if hum.Health <= 0 then
		return
	end
	-- античит: дистанция и границы
	local dist = (position - hrp.Position).Magnitude
	if dist > Config.GUN.range + 24 or dist < Config.GUN.minDistance then
		return
	end
	local b = Config.GUN.bounds
	if math.abs(position.X) > b or math.abs(position.Z) > b or position.Y < -110 or position.Y > 900 then
		return
	end
	portalCooldown[player] = now()
	playerPortals[player] = playerPortals[player] or {}
	killPortal(player, kind)
	task.spawn(function()
		spawnPlayerPortal(player, kind, position, normal)
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	local state = playerPortals[player]
	if state then
		for kind in pairs(state) do
			killPortal(player, kind, true)
		end
	end
	playerPortals[player] = nil
	portalCooldown[player] = nil
end)

-- ============================================================ персонажи
local npcs = {} -- { anim = RigAnim, model = Model, kind = string, seed = number, state = string, t = 0 }

local function findNPCs()
	for _, d in ipairs(workspace:GetDescendants()) do
		if d:IsA("Model") and string.sub(d.Name, 1, 4) == "NPC_" then
			local anim = RigAnim.new(d)
			if anim then
				local kind = "rick"
				local cfg = d:FindFirstChild("RigConfig")
				local kindValue = cfg and cfg:FindFirstChild("Kind")
				if kindValue and kindValue:IsA("StringValue") then
					kind = kindValue.Value
				end
				table.insert(npcs, {
					anim = anim,
					model = d,
					kind = kind,
					seed = math.random() * 10,
					state = "idle",
					t = 0,
					props = {},
					base = d:GetPivot(),
				})
			end
		end
	end
end

local function npcPose(npc, dt: number)
	npc.t += dt
	local t, seed, kind = npc.t, npc.seed, npc.kind
	local pose
	if npc.state == "walk" and npc.walkTime then
		pose = RigAnim.walkPose(npc.walkClock or 0, 9)
	elseif npc.state == "scared" or kind == "morty" then
		pose = RigAnim.scaredPose(t, seed)
	elseif npc.state == "laugh" then
		pose = RigAnim.laughPose(t)
	elseif npc.state == "cover" then
		pose = RigAnim.coverPose(t)
	elseif npc.state == "aim" then
		pose = RigAnim.aimPose(t, npc.aimAngle or 20)
	elseif kind == "evilmorty" then
		pose = RigAnim.behindBackPose(t)
	elseif kind == "rick" then
		pose = RigAnim.holdPose(t)
	elseif kind == "council" then
		local talk = (math.sin(t * 0.6 + seed) > 0.55)
		pose = RigAnim.idlePose(t, seed, 0.8)
		if talk then
			pose.rarm = CFrame.Angles(math.rad(-52 + math.sin(t * 3) * 16), 0, math.rad(28))
			pose.neck = CFrame.Angles(math.rad(math.sin(t * 2) * 6), math.rad(math.sin(t * 0.9) * 22), 0)
		end
	elseif kind == "guard" then
		pose = RigAnim.idlePose(t, seed, 0.6)
		pose.neck = CFrame.Angles(math.rad(math.sin(t * 0.5) * 4), math.rad(math.sin(t * 0.35 + seed) * 42), 0)
	else
		pose = RigAnim.idlePose(t, seed, 0.9)
	end
	if npc.extra then
		for k, v in pairs(npc.extra) do
			pose[k] = v
		end
	end
	npc.anim:apply(pose)
end

-- плавное перемещение рига по пути (для «проходов через портал»)
local function walkRig(npc, from: CFrame, to: CFrame, duration: number)
	npc.state = "walk"
	local steps = 12
	for i = 1, steps do
		local a = i / steps
		local eased = a * a * (3 - 2 * a)
		npc.walkClock = a * duration * 9
		npc.model:PivotTo(from:Lerp(to, eased))
		npc.walkTime = true
		task.wait(duration / steps)
	end
	npc.walkTime = nil
	npc.state = "idle"
end

-- ============================================================ шоу персонажей
local function rigGunParts(npc)
	local muzzle = npc.model:FindFirstChild("Muzzle", true)
	local vial = npc.model:FindFirstChild("Vial", true)
	return muzzle, vial
end

local function chargeUp(npc, palette, duration: number)
	local muzzle = rigGunParts(npc)
	npc.state = "aim"
	npc.aimAngle = 34
	local sound = nil
	if muzzle then
		local light = muzzle:FindFirstChildOfClass("PointLight")
		if light then
			light.Brightness = 3
			TweenService:Create(light, TweenInfo.new(duration), { Brightness = 14, Range = 34 }):Play()
		end
		sound = Fx.playSound(muzzle.CFrame, Config.SOUNDS.open, 0.5, 0.5, 90)
		if sound then
			sound.Looped = true
			TweenService:Create(sound, TweenInfo.new(duration), { PlaybackSpeed = 1.6 }):Play()
		end
	end
	task.wait(duration)
	if sound then
		sound:Stop()
		sound.Parent:Destroy()
	end
	return muzzle
end

local function firePortalFrom(npc, palette, distance: number, radius: number, linkOther)
	local root = npc.model:FindFirstChild("HumanoidRootPart") :: BasePart
	local cf = root.CFrame
	local dir = cf.LookVector * Vector3.new(1, 0, 1)
	if dir.Magnitude < 0.1 then
		dir = Vector3.new(0, 0, 1)
	end
	dir = dir.Unit
	local position = root.Position + dir * distance + Vector3.new(0, 2.5, 0)
	local portalCF = Config.portalCF(position, dir)
	local model = Fx.buildPortal(livePortals, portalCF, palette, radius, "Portal_NPC_" .. npc.model.Name .. "_" .. tostring(os.time()))
	local rec = registerPortal(model)
	local muzzle = rigGunParts(npc)
	if muzzle then
		Fx.muzzleFlash(muzzle.CFrame * CFrame.new(0, 0, -2), palette, 1.4)
		Fx.tracer(muzzle.Position, position, palette)
		local light = muzzle:FindFirstChildOfClass("PointLight")
		if light then
			TweenService:Create(light, TweenInfo.new(0.7, Enum.EasingStyle.Quad), { Brightness = 3, Range = 16 }):Play()
		end
	end
	Fx.openBurst(portalCF, palette, radius)
	Fx.shockwave(portalCF, palette, radius * 2.4)
	PortalEvent:FireAllClients("shake", position, 1)
	PortalEvent:FireAllClients("flash", position, palette, 0.75)
	return rec
end

local function showRickPrime(npc)
	-- Рик Прайм: заряжает пушку и открывает ЗЕЛЁНЫЙ портал
	npc.state = "idle"
	task.wait(6 + math.random() * 6)
	while true do
		local mouth = rigGunParts(npc)
		chargeUp(npc, "green", 2)
		local portal = firePortalFrom(npc, "green", 9, 11)
		npc.state = "laugh"
		task.wait(1.6)
		npc.state = "aim"
		npc.aimAngle = 26
		task.wait(4.5)
		if portal then
			Fx.implode(portal.model, "green", 11)
			if portal.exit and portal.exit.exit == portal then
				portal.exit.exit = nil
			end
		end
		npc.state = "idle"
		task.wait(9 + math.random() * 7)
	end
end

local function showEvilMorty(npc)
	-- Злой Морти: крутит пушку, стреляет ЖЁЛТЫМ порталом и уходит в него
	npc.state = "idle"
	task.wait(9 + math.random() * 5)
	while true do
		npc.spin = true
		task.wait(2.4)
		local portal = firePortalFrom(npc, "yellow", 10, 10)
		npc.spin = false
		task.wait(0.6)
		local from = npc.model:GetPivot()
		local dir = from.LookVector * Vector3.new(1, 0, 1)
		dir = (dir.Magnitude > 0.1) and dir.Unit or Vector3.new(0, 0, 1)
		local into = CFrame.lookAt(portal.cf.Position - dir * 2.5, portal.cf.Position + dir)
		walkRig(npc, from, into, 2.2)
		-- вошёл в портал
		burstAt(portal.cf, "yellow", 10)
		npc.model:PivotTo(CFrame.lookAt(npc.base.Position + Vector3.new(0, 0, -40), npc.base.Position + Vector3.new(0, 0, 0)))
		task.wait(0.2)
		burstAt(npc.model:GetPivot(), "yellow", 10)
		npc.state = "laugh"
		task.wait(3)
		npc.state = "idle"
		walkRig(npc, npc.model:GetPivot(), npc.base, 3)
		if portal then
			Fx.implode(portal.model, "yellow", 10)
		end
		task.wait(10 + math.random() * 6)
	end
end

local function showRickAndMorty(rick, morty)
	-- Рик стреляет, Морти в панике убегает в портал и возвращается
	rick.state = "idle"
	morty.state = "idle"
	task.wait(12 + math.random() * 8)
	while true do
		chargeUp(rick, "green", 1.4)
		local portal = firePortalFrom(rick, "green", 11, 10)
		-- Морти паникует
		morty.state = "scared"
		Fx.playSound(morty.model:GetPivot().Position, Config.SOUNDS.scream, 0.8, 1.05, 160)
		task.wait(1.1)
		local mFrom = morty.model:GetPivot()
		local into = CFrame.lookAt(portal.cf.Position - portal.cf.LookVector * 0 + normalOf(portal.cf) * -2.5, portal.cf.Position + normalOf(portal.cf))
		walkRig(morty, mFrom, into, 1.5)
		burstAt(portal.cf, "green", 10)
		morty.model:PivotTo(rick.base * CFrame.new(-6, 0, -8))
		task.wait(0.15)
		burstAt(morty.model:GetPivot(), "green", 8)
		morty.state = "cover"
		rick.state = "aim"
		rick.aimAngle = 18
		task.wait(4)
		if portal then
			Fx.implode(portal.model, "green", 10)
		end
		rick.state = "idle"
		morty.state = "idle"
		task.wait(14 + math.random() * 10)
	end
end

local function screamLoop(npc)
	-- Морти иногда орёт просто так
	while true do
		task.wait(11 + math.random() * 12)
		if npc.state == "idle" then
			npc.state = "scared"
			Fx.playSound(npc.model:GetPivot().Position, Config.SOUNDS.scream, 0.6, 0.9 + math.random() * 0.3, 120)
			task.wait(1.6)
			npc.state = "idle"
		end
	end
end

-- ============================================================ диалоги
local function say(npc, text: string)
	local head = npc.model:FindFirstChild("Head") or npc.model:FindFirstChild("Torso")
	if not head then
		return
	end
	Talk:FireAllClients(head, text, 5.5)
	Fx.playSound(head.Position, Config.SOUNDS.jump, 0.35, 1.4 + math.random() * 0.3, 60)
end

local function pickQuote(npc, index: number?)
	local list = Config.QUOTES[npc.kind] or Config.QUOTES.rick
	local line = list[math.random(1, #list)]
	if string.find(line, "%%d") then
		line = string.gsub(line, "%%d", tostring(100 + math.random(1, 60)))
	end
	return line
end

local function bindNPC(npc)
	local prompt = npc.model:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.Triggered:Connect(function(player)
			if npc.talking then
				return
			end
			npc.talking = true
			say(npc, pickQuote(npc))
			task.wait(6)
			npc.talking = false
		end)
	end
	local click = npc.model:FindFirstChildOfClass("ClickDetector")
	if click then
		click.MouseClick:Connect(function()
			say(npc, pickQuote(npc))
			if npc.kind == "rickprime" or npc.kind == "rick" then
				npc.forcePortal = true
			elseif npc.kind == "morty" then
				npc.state = "scared"
				Fx.playSound(npc.model:GetPivot().Position, Config.SOUNDS.scream, 0.9, 1, 180)
			elseif npc.kind == "evilmorty" then
				npc.state = "laugh"
			end
		end)
	end
end

-- ============================================================ главный цикл
local function main()
	setupStaticPortals()
	task.wait(1)
	findNPCs()
	print("[Порталы] Персонажей найдено:", #npcs, "· статичных порталов:", (function()
		local n = 0
		for _ in pairs(staticPortals) do
			n += 1
		end
		return n
	end)())

	for _, npc in ipairs(npcs) do
		bindNPC(npc)
	end

	-- ищем Рика и Морти для совместного шоу
	local rick, morty, prime, evil
	for _, npc in ipairs(npcs) do
		if npc.kind == "rickprime" then
			prime = npc
		elseif npc.kind == "evilmorty" then
			evil = npc
		elseif npc.kind == "rick" then
			rick = npc
		elseif npc.kind == "morty" then
			morty = npc
		end
	end

	-- цикл поз
	task.spawn(function()
		local last = now()
		while true do
			local dt = now() - last
			last = now()
			for _, npc in ipairs(npcs) do
				-- по клику по персонажу: он сразу открывает свой портал
				if npc.forcePortal and not npc.quick then
					npc.forcePortal = nil
					npc.quick = true
					local pal = (npc.kind == "evilmorty") and "yellow" or "green"
					task.spawn(function()
						chargeUp(npc, pal, 1.1)
						local portal = firePortalFrom(npc, pal, 10, 10)
						npc.state = (npc.kind == "evilmorty") and "laugh" or "aim"
						task.wait(6)
						if portal then
							Fx.implode(portal.model, pal, 10)
						end
						npc.state = "idle"
						npc.quick = false
					end)
				end
				-- «спин» пушки Злого Морти
				if npc.spin then
					npc.spinAngle = (npc.spinAngle or 0) + dt * 12
					npc.extra = { rarm = CFrame.Angles(math.rad(-72), 0, npc.spinAngle) }
				elseif npc.extra then
					npc.extra = nil
				end
				npcPose(npc, dt)
			end
			RunService.Heartbeat:Wait()
		end
	end)

	if prime then
		task.spawn(showRickPrime, prime)
	end
	if evil then
		task.spawn(showEvilMorty, evil)
	end
	if rick and morty then
		task.spawn(showRickAndMorty, rick, morty)
	end
	if morty then
		task.spawn(screamLoop, morty)
	end
end

main()
