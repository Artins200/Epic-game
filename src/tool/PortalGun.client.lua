-- Портальная пушка игрока: ЛКМ — зелёный портал (Рик Прайм), ПКМ — жёлтый (Злой Морти).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local mouse = player:GetMouse()
local camera = workspace.CurrentCamera

local tool = script.Parent
local handle = tool:WaitForChild("Handle")
local muzzle = tool:WaitForChild("Muzzle")

local System = ReplicatedStorage:WaitForChild("PortalGunSystem")
local Config = require(System:WaitForChild("Config"))
local Fx = require(System:WaitForChild("Fx"))
local Remotes = System:WaitForChild("Remotes")
local FirePortal = Remotes:WaitForChild("FirePortal") :: RemoteEvent

local equipped = false
local lastShot = 0
local lastKind = "yellow" -- первый выстрел всегда зелёный
local character: Model? = nil
local npcFilter: { Instance } = {}

local function refreshCharacters()
	character = player.Character
	local filter: { Instance } = {}
	if character then
		table.insert(filter, character)
	end
	table.insert(filter, tool)
	for _, d in ipairs(workspace:GetDescendants()) do
		if d:IsA("Model") and string.sub(d.Name, 1, 4) == "NPC_" then
			table.insert(filter, d)
		end
	end
	npcFilter = filter
end

-- ============================================================ прицеливание
local function refreshCharactersIfNeeded()
	if not character or character.Parent == nil then
		refreshCharacters()
	end
end

local function aim()
	refreshCharactersIfNeeded()
	local origin = camera.CFrame.Position
	local target = mouse.Hit.Position
	local dir = target - origin
	if dir.Magnitude < 0.1 then
		return nil
	end
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = npcFilter
	params.IgnoreWater = true
	local result = workspace:Raycast(origin, dir.Unit * Config.GUN.range, params)
	if not result then
		return nil
	end
	local model = result.Instance:FindFirstAncestorOfClass("Model")
	if model and model:FindFirstChildOfClass("Humanoid") then
		return nil
	end
	return result.Position, result.Normal
end

-- ============================================================ сочная отдача
local kickConn: RBXScriptConnection? = nil
local function kick(power: number)
	if kickConn then
		kickConn:Disconnect()
	end
	local t0 = os.clock()
	local dur = 0.22
	kickConn = RunService:BindToRenderStep("PortalGunKick", Enum.RenderPriority.Camera.Value + 1, function()
		local a = (os.clock() - t0) / dur
		if a >= 1 then
			if kickConn then
				kickConn:Disconnect()
			end
			kickConn = nil
			return
		end
		local falloff = (1 - a) * (1 - a)
		camera.CFrame = camera.CFrame * CFrame.Angles(math.rad(-3.2 * power * falloff), math.rad((math.random() - 0.5) * 3 * power * falloff), math.rad((math.random() - 0.5) * 2 * power * falloff))
	end)
end

local baseGrip = tool.GripPos
local function recoil()
	tool.GripPos = baseGrip + Vector3.new(-0.06, 0, 0.26)
	TweenService:Create(tool, TweenInfo.new(0.19, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { GripPos = baseGrip }):Play()
end

-- ============================================================ выстрел
local function shoot(kind: string)
	if not equipped or tool.Parent == nil then
		return
	end
	local t = os.clock()
	if t - lastShot < Config.GUN.cooldown then
		return
	end
	local pos, normal = aim()
	if not pos or not normal then
		return
	end
	lastShot = t
	lastKind = kind

	local from = muzzle.Position

	-- локальные эффекты (мгновенно, без ожидания сервера)
	local ringCF = Config.portalCF(pos, normal)
	Fx.muzzleFlash(muzzle.CFrame * CFrame.new(0, 0, -1.6), kind, 1.25)
	Fx.tracer(from, pos, kind)
	Fx.shockwave(ringCF, kind, 16)
	kick(1)
	recoil()

	-- серверу: создаём настоящий портал
	FirePortal:FireServer(kind, pos, normal)
end

-- ============================================================ ввод и tool
local function onActivated()
	shoot("green")
end

local function onInputBegan(input, processed)
	if processed then
		return
	end
	if input.UserInputType == Enum.UserInputType.MouseButton2 and equipped then
		shoot("yellow")
	elseif input.UserInputType == Enum.UserInputType.Touch and equipped then
		shoot((lastKind == "green") and "yellow" or "green")
	end
end

tool.Activated:Connect(onActivated)
UserInputService.InputBegan:Connect(onInputBegan)

tool.Equipped:Connect(function()
	equipped = true
	character = player.Character
	refreshCharacters()
	mouse.TargetFilter = tool
	local light = muzzle:FindFirstChildOfClass("PointLight")
	if light then
		TweenService:Create(light, TweenInfo.new(0.35), { Brightness = 5, Range = 26 }):Play()
	end
	Fx.playSound(handle.Position, Config.SOUNDS.jump, 0.35, 1.7, 40)
end)

tool.Unequipped:Connect(function()
	equipped = false
	mouse.TargetFilter = nil
	local light = muzzle:FindFirstChildOfClass("PointLight")
	if light then
		TweenService:Create(light, TweenInfo.new(0.35), { Brightness = 2.6, Range = 16 }):Play()
	end
end)

player.CharacterAdded:Connect(function()
	character = nil
	task.wait(0.5)
	refreshCharacters()
end)

refreshCharacters()

-- подсказка при первом включении
task.delay(6, function()
	if not equipped then
		local sound = Fx.playSound(camera.CFrame.Position, Config.SOUNDS.open, 0.25, 1.9, 40)
		if sound then
			sound.Looped = false
		end
	end
end)
