--!strict
-- Процедурная анимация R6-ригов без загрузки готовых анимаций.
-- Все детали NPC закреплены (Anchored), поэтому физические суставы их не двигают:
-- RigAnim сам пересчитывает CFrame деталей от родителя к ребёнку,
-- а затем переносит приваренные декорации (глаза, волосы, пушка) по их сваркам.
local RigAnim = {}
RigAnim.__index = RigAnim

-- порядок важен: сначала корень, потом шея/руки/ноги
local JOINTS = {
	{ joint = "RootJoint", key = "root" },
	{ joint = "Neck", key = "neck" },
	{ joint = "Right Shoulder", key = "rarm" },
	{ joint = "Left Shoulder", key = "larm" },
	{ joint = "Right Hip", key = "rleg" },
	{ joint = "Left Hip", key = "lleg" },
}

local IDENTITY = CFrame.new()

local function isPart(inst: Instance): boolean
	return inst:IsA("BasePart")
end

--- Собирает сварки модели: для каждой приваренной детали — родитель и смещение.
local function collectWelds(model: Model)
	local links: { [BasePart]: { parent: BasePart, offset: CFrame } } = {}
	for _, d in ipairs(model:GetDescendants()) do
		local p0, p1
		if d:IsA("WeldConstraint") then
			p0, p1 = d.Part0, d.Part1
		elseif d:IsA("Weld") then
			p0, p1 = d.Part0, d.Part1
		end
		if p0 and p1 and isPart(p0) and isPart(p1) and p1 ~= p0 and not links[p1] then
			if d:IsA("Weld") then
				links[p1] = { parent = p0, offset = d.C0 * d.C1:Inverse() }
			else
				links[p1] = { parent = p0, offset = p0.CFrame:Inverse() * p1.CFrame }
			end
		end
	end
	return links
end

function RigAnim.new(model: Model)
	local torso = model:FindFirstChild("Torso")
	if not torso then
		return nil
	end
	local self = setmetatable({}, RigAnim)
	self.model = model
	self.joints = {}
	self.decor = {}

	local links = collectWelds(model)
	local moving: { [BasePart]: boolean } = {}

	-- суставы в порядке родитель → ребёнок
	for _, info in ipairs(JOINTS) do
		local joint = torso:FindFirstChild(info.joint)
		if not joint then
			-- запасной вариант: риг мог положить Motor6D не в Torso, а в саму модель
			joint = model:FindFirstChild(info.joint, true)
		end
		if joint and joint:IsA("Motor6D") and isPart(joint.Part0) and isPart(joint.Part1) then
			table.insert(self.joints, {
				key = info.key,
				motor = joint,
				part0 = joint.Part0 :: BasePart,
				part1 = joint.Part1 :: BasePart,
				c0 = joint.C0,
				c1inv = joint.C1:Inverse(),
			})
			moving[joint.Part1 :: BasePart] = true
		end
	end
	if #self.joints == 0 then
		return nil
	end

	-- декорации: сначала те, что приварены к корпусу, затем к их детям (порядок по глубине)
	local pending = {}
	for part, link in pairs(links) do
		pending[part] = link
	end
	local placed: { [BasePart]: boolean } = {}
	for _, j in ipairs(self.joints) do
		placed[j.part1] = true
	end
	local guard = 0
	while next(pending) and guard < 64 do
		guard += 1
		for part, link in pairs(pending) do
			if placed[link.parent] then
				table.insert(self.decor, { part = part, parent = link.parent, offset = link.offset })
				placed[part] = true
				pending[part] = nil
			end
		end
	end
	return self
end

--- Применить позу: pose = { root = CFrame, neck = CFrame, rarm = CFrame, ... }
function RigAnim:apply(pose)
	for _, j in ipairs(self.joints) do
		local offset = pose[j.key] or IDENTITY
		j.part1.CFrame = j.part0.CFrame * (j.c0 * offset) * j.c1inv
	end
	for _, d in ipairs(self.decor) do
		d.part.CFrame = d.parent.CFrame * d.offset
	end
end

--- Полный сброс в исходную позу
function RigAnim:reset()
	for _, j in ipairs(self.joints) do
		j.part1.CFrame = j.part0.CFrame * j.c0 * j.c1inv
	end
	for _, d in ipairs(self.decor) do
		d.part.CFrame = d.parent.CFrame * d.offset
	end
end

--- Готовая поза «спокойное дыхание + осмотр»
function RigAnim.idlePose(t: number, seed: number, intensity: number?)
	local k = intensity or 1
	local s = seed or 0
	local breathe = math.sin(t * 1.4 + s) * 0.03 * k
	return {
		root = CFrame.new(0, breathe, 0) * CFrame.Angles(math.rad(math.sin(t * 0.6 + s) * 1.4 * k), 0, 0),
		neck = CFrame.Angles(math.rad(math.sin(t * 0.45 + s * 2) * 7 * k), math.rad(math.sin(t * 0.31 + s) * 16 * k), 0),
		rarm = CFrame.Angles(math.rad(math.sin(t * 1.2 + s) * 4 * k), 0, math.rad(3 * k)),
		larm = CFrame.Angles(math.rad(math.sin(t * 1.2 + s + 1) * 4 * k), 0, math.rad(-3 * k)),
	}
end

--- Поза «трясётся от страха» (Морти)
function RigAnim.scaredPose(t: number, seed: number)
	local s = seed or 0
	local shake = math.sin(t * 26 + s) * 0.035
	local shake2 = math.cos(t * 31 + s) * 0.03
	return {
		root = CFrame.new(shake, math.sin(t * 3 + s) * 0.05, shake2) * CFrame.Angles(math.rad(math.sin(t * 22) * 2), math.rad(shake * 90), 0),
		neck = CFrame.Angles(math.rad(math.sin(t * 25) * 5), math.rad(math.sin(t * 9) * 22), math.rad(math.sin(t * 20) * 4)),
		rarm = CFrame.Angles(math.rad(-70 + math.sin(t * 18) * 10), 0, math.rad(24 + shake * 60)),
		larm = CFrame.Angles(math.rad(-70 + math.cos(t * 17) * 10), 0, math.rad(-24 - shake2 * 60)),
	}
end

--- Поза «идёт»: t — время, speed — темп
function RigAnim.walkPose(t: number, speed: number)
	local s = math.sin(t * speed)
	return {
		root = CFrame.new(0, math.abs(math.sin(t * speed)) * 0.12, 0),
		rleg = CFrame.Angles(math.rad(s * 38), 0, 0),
		lleg = CFrame.Angles(math.rad(-s * 38), 0, 0),
		rarm = CFrame.Angles(math.rad(-s * 26), 0, math.rad(6)),
		larm = CFrame.Angles(math.rad(s * 26), 0, math.rad(-6)),
		neck = CFrame.Angles(math.rad(3), math.rad(math.sin(t * 0.7) * 8), 0),
	}
end

--- Поза «держит пушку двумя руками и целится»: aim — угол подъёма в градусах
function RigAnim.aimPose(t: number, aim: number)
	local sway = math.sin(t * 1.6) * 2
	return {
		rarm = CFrame.Angles(math.rad(-aim + sway), 0, math.rad(10)),
		larm = CFrame.Angles(math.rad(-aim * 0.55 + sway), math.rad(-24), math.rad(-42)),
		neck = CFrame.Angles(math.rad(-aim * 0.22 + 2), math.rad(sway * 0.6), 0),
		root = CFrame.new(0, math.sin(t * 1.5) * 0.04, 0) * CFrame.Angles(0, math.rad(-6), 0),
	}
end

--- Поза «хохочет» (Злой Морти / Рик Прайм)
function RigAnim.laughPose(t: number)
	local k = math.sin(t * 14) * 0.5 + 0.5
	return {
		root = CFrame.new(0, k * 0.22, 0) * CFrame.Angles(math.rad(6 + k * 4), 0, 0),
		neck = CFrame.Angles(math.rad(-16 - k * 10), math.rad(math.sin(t * 7) * 8), 0),
		rarm = CFrame.Angles(math.rad(-30 - k * 12), 0, math.rad(26)),
		larm = CFrame.Angles(math.rad(-30 - k * 12), 0, math.rad(-26)),
	}
end

--- Поза «испугался и закрывается руками» (Морти)
function RigAnim.coverPose(t: number)
	local k = math.abs(math.sin(t * 5))
	return {
		root = CFrame.new(0, -0.1 * k, 0.1 * k),
		neck = CFrame.Angles(math.rad(18), math.rad(math.sin(t * 3) * 6), 0),
		rarm = CFrame.Angles(math.rad(-118), 0, math.rad(-34)),
		larm = CFrame.Angles(math.rad(-118), 0, math.rad(34)),
	}
end

--- Поза «держит руки за спиной» (Злой Морти в стойке)
function RigAnim.behindBackPose(t: number)
	return {
		root = CFrame.new(0, math.sin(t * 1.5) * 0.03, 0),
		neck = CFrame.Angles(math.rad(math.sin(t * 0.5) * 4), math.rad(math.sin(t * 0.33) * 20), 0),
		rarm = CFrame.Angles(math.rad(12), 0, math.rad(-34)),
		larm = CFrame.Angles(math.rad(12), 0, math.rad(34)),
	}
end

--- Поза «стоит с поднятой пушкой» (Рик C-137)
function RigAnim.holdPose(t: number)
	return {
		root = CFrame.new(0, math.sin(t * 1.2) * 0.04, 0) * CFrame.Angles(math.rad(-4), 0, math.rad(3)),
		neck = CFrame.Angles(math.rad(math.sin(t * 0.7) * 6), math.rad(math.sin(t * 0.4) * 12), 0),
		rarm = CFrame.Angles(math.rad(-26 + math.sin(t * 1.1) * 5), 0, math.rad(16)),
		larm = CFrame.Angles(math.rad(8), 0, math.rad(-8)),
	}
end

return RigAnim
