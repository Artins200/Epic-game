--!strict
-- Единый конфиг всей портальной системы: цвета, звуки и реплики персонажей.
local Config = {}

-- Палитры порталов. green — Рик Прайм, yellow — Злой Морти.
Config.PALETTES = {
	green = {
		mid = Color3.fromRGB(50, 230, 120),
		core = Color3.fromRGB(160, 255, 195),
		deep = Color3.fromRGB(12, 130, 60),
		light = Color3.fromRGB(90, 255, 160),
		spark = Color3.fromRGB(120, 255, 180),
	},
	yellow = {
		mid = Color3.fromRGB(255, 208, 40),
		core = Color3.fromRGB(255, 246, 190),
		deep = Color3.fromRGB(170, 112, 8),
		light = Color3.fromRGB(255, 220, 80),
		spark = Color3.fromRGB(255, 235, 140),
	},
	cyan = {
		mid = Color3.fromRGB(80, 210, 255),
		core = Color3.fromRGB(200, 250, 255),
		deep = Color3.fromRGB(16, 108, 168),
		light = Color3.fromRGB(120, 220, 255),
		spark = Color3.fromRGB(170, 235, 255),
	},
	magenta = {
		mid = Color3.fromRGB(255, 100, 220),
		core = Color3.fromRGB(255, 210, 250),
		deep = Color3.fromRGB(150, 24, 130),
		light = Color3.fromRGB(255, 120, 230),
		spark = Color3.fromRGB(255, 170, 240),
	},
	orange = {
		mid = Color3.fromRGB(255, 150, 50),
		core = Color3.fromRGB(255, 230, 190),
		deep = Color3.fromRGB(170, 70, 10),
		light = Color3.fromRGB(255, 170, 90),
		spark = Color3.fromRGB(255, 200, 130),
	},
}

-- Настройки портальной пушки игрока
Config.GUN = {
	range = 420,          -- максимальная дальность выстрела
	cooldown = 0.32,      -- перезарядка между выстрелами
	minDistance = 7,      -- нельзя ставить портал вплотную к себе
	portalRadius = 11,    -- радиус портала игрока
	maxPortalsPerPlayer = 2,
	bounds = 780,         -- граница мира по X/Z
}

Config.SOUNDS = {
	shoot = "rbxasset://sounds/electronicpingshort.wav",
	open = "rbxasset://sounds/electronicpingshort.wav",
	close = "rbxasset://sounds/snap.wav",
	teleport = "rbxasset://sounds/electronicpingshort.wav",
	scream = "rbxasset://sounds/uuhhh.mp3",
	jump = "rbxasset://sounds/action_jump.mp3",
	fall = "rbxasset://sounds/action_falling.mp3",
}

-- Реплики (клик или клавиша E по персонажу)
Config.QUOTES = {
	rickprime = {
		"Вабба лабба даб даб… тебе мной не стать.",
		"Я — оригинал. Всё остальное — черновики.",
		"Портал — это просто дверь. Ломаю двери я.",
		"Твой Морти умрёт первым. Потом ты. По алфавиту.",
		"Никто не уходит от меня. Даже я.",
	},
	evilmorty = {
		"Я не злой. Я просто эффективный.",
		"Все вы — марионетки в моём портале.",
		"Демократия? На Цитадели это временно.",
		"Скажи «Морти», и тебя простят. Может быть.",
		"Я прочитал их документы. Все. Дважды.",
	},
	rick = {
		"Слушай, Морти, это займёт двадцать минут. И сорок лет.",
		"Я не герой. Я учёный, который всё сломал.",
		"Бурп… кто-нибудь принесёт мне соус?",
		"Наука, Морти! Не моргай, всё взорвётся.",
		"Мне нужен перерыв. Лет на пятьсот.",
	},
	morty = {
		"Оу-у-у, Рик, мне страшно!",
		"А-а, не надо меня в это втягивать!",
		"Я просто хочу домой, к маме!",
		"Это же опасно? Опасно?!",
		"Я не подписывался на это-о-о!",
	},
	guard = {
		"Проходите. И не трогайте статую.",
		"Совет заседает. Морти не пускаем.",
		"Порталы на станции — только через проверку.",
	},
	council = {
		"Делегат №%d: предлагаю не умирать.",
		"Делегат №%d: портал в секторе 37-C стабилен.",
		"Делегат №%d: а где мой Морти?",
		"Делегат №%d: это нарушает устав Совета!",
	},
	statue = {
		"Камень. Молчит. Мудро.",
	},
}

-- Название зоны по имени портала-хаба (для HUD)
Config.ZONE_LABELS = {
	Portal_Hub_Wasteland = "ЗОНА 1 · МАД МАКС",
	Portal_Hub_Alien = "ЗОНА 2 · АЛИЕН-МИР",
	Portal_Hub_Citadel = "ЗОНА 3 · ЦИТАДЕЛЬ",
}

--- CFrame портала: локальная ось +X смотрит по нормали (как у статичных порталов мира).
function Config.portalCF(position: Vector3, normal: Vector3): CFrame
	local x = normal.Magnitude > 0.001 and normal.Unit or Vector3.new(0, 0, 1)
	local up = Vector3.new(0, 1, 0)
	if math.abs(x:Dot(up)) > 0.98 then
		up = Vector3.new(0, 0, 1)
	end
	return CFrame.fromMatrix(position, x, up)
end

function Config.palette(name)
	return Config.PALETTES[name] or Config.PALETTES.green
end

return Config
