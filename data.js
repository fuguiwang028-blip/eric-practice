const MODULES = {"phonics": "自然拼读", "grammar": "语法初阶", "starter": "语言运用"};
const LESSONS = {"phonics": {"title": "短元音 u", "board": "短元音 u 读 /ʌ/。\n-ut：nut、hut、cut\n-ub：cub、tub\n-um：gum、hum\n-un：bun、run、fun", "questions": [{"kind": "choice", "prompt": "哪一个词和 hut 押韵？", "choices": ["tub", "cut", "hum"], "answer": 1, "explanation": "hut 和 cut 的词尾都是 -ut。"}, {"kind": "choice", "prompt": "哪一个词表示「浴缸」？", "choices": ["tub", "nut", "gum"], "answer": 0, "explanation": "tub 表示浴缸。"}, {"kind": "choice", "prompt": "哪一个词和 gum 属于同一词族？", "choices": ["bun", "hut", "hum"], "answer": 2, "explanation": "gum 和 hum 的词尾都是 -um。"}, {"kind": "choice", "prompt": "b + un 拼成什么？", "choices": ["run", "bun", "fun"], "answer": 1, "explanation": "b 加 -un 拼成 bun。"}, {"kind": "choice", "prompt": "哪一个词表示「坚果」？", "choices": ["nut", "cub", "cut"], "answer": 0, "explanation": "nut 表示坚果。"}, {"kind": "choice", "prompt": "c + ub 拼成什么？", "choices": ["cut", "cub", "cup"], "answer": 1, "explanation": "c 加 -ub 拼成 cub。"}, {"kind": "choice", "prompt": "run 的词尾是哪个？", "choices": ["-ut", "-um", "-un"], "answer": 2, "explanation": "run 由 r 和 -un 拼成。"}, {"kind": "choice", "prompt": "哪个词和 bun 押韵？", "choices": ["gum", "fun", "hut"], "answer": 1, "explanation": "bun 和 fun 都以 -un 结尾。"}, {"kind": "choice", "prompt": "「哼唱」对应哪个词？", "choices": ["hum", "hut", "gum"], "answer": 0, "explanation": "hum 表示哼唱。"}, {"kind": "choice", "prompt": "「小熊」对应哪个词？", "choices": ["fun", "cub", "nut"], "answer": 1, "explanation": "cub 表示幼兽，这里指小熊。"}, {"kind": "read", "prompt": "The cub can hum in the tub.", "explanation": "留意 cub 和 tub 的 -ub，以及 hum 的 -um。"}]}, "grammar": {"title": "一般现在时", "board": "一般现在时可以说习惯、事实和喜好。\n第三人称单数的肯定句中，动词通常加 -s 或 -es。\n频率副词常放在实义动词前、be 动词后。", "questions": [{"kind": "choice", "prompt": "哪一句描述日常习惯？", "choices": ["I walk to school every day.", "I walked to school yesterday.", "I am walking now."], "answer": 0, "explanation": "every day 表示每天，描述重复发生的活动。"}, {"kind": "choice", "prompt": "Mia ___ English on Sundays.", "choices": ["study", "studies", "studying"], "answer": 1, "explanation": "study 的 y 前是辅音字母，变 y 为 i 再加 -es。"}, {"kind": "choice", "prompt": "Ben ___ a bike.", "choices": ["have", "having", "has"], "answer": 2, "explanation": "Ben 是第三人称单数，have 变 has。"}, {"kind": "choice", "prompt": "「从不」对应哪个词？", "choices": ["often", "never", "usually"], "answer": 1, "explanation": "never 表示从不。"}, {"kind": "choice", "prompt": "选出 usually 紧跟在 be 动词后的句子。", "choices": ["She usually is ready.", "Usually she is ready.", "She is usually ready."], "answer": 2, "explanation": "在 C 项中，usually 紧跟在 is 后。"}, {"kind": "choice", "prompt": "They ___ football every Friday.", "choices": ["play", "plays", "playing"], "answer": 0, "explanation": "They 搭配动词原形 play。"}, {"kind": "choice", "prompt": "She ___ the dishes after dinner.", "choices": ["washs", "washes", "wash"], "answer": 1, "explanation": "wash 以 sh 结尾，第三人称单数加 -es。"}, {"kind": "choice", "prompt": "The sun rises in the east. 表达什么？", "choices": ["喜好", "拥有", "客观事实"], "answer": 2, "explanation": "太阳从东方升起是客观事实。"}, {"kind": "choice", "prompt": "Tom ___ to school by bus.", "choices": ["goes", "go", "going"], "answer": 0, "explanation": "Tom 是第三人称单数，go 变 goes。"}, {"kind": "choice", "prompt": "always 通常放在哪里？ I ___ walk to school.", "choices": ["walk 后面", "walk 前面", "句末"], "answer": 1, "explanation": "always 常放在实义动词 walk 前。"}]}, "starter": {"title": "初次见面与课堂动作", "board": "What’s your name? 你叫什么名字？\nMy name is Ella. 我叫 Ella。\nNice to meet you! 很高兴认识你！\nlisten to the teacher 听老师讲", "questions": [{"kind": "choice", "prompt": "「早上好」怎么说？", "choices": ["Goodbye!", "Good morning!", "Good afternoon!"], "answer": 1, "explanation": "Good morning! 用于早上的问候。"}, {"kind": "choice", "prompt": "I ___ Mike.", "choices": ["is", "are", "am"], "answer": 2, "explanation": "I 与 am 搭配。"}, {"kind": "choice", "prompt": "My name ___ Ella.", "choices": ["is", "am", "are"], "answer": 0, "explanation": "My name 搭配 is。"}, {"kind": "choice", "prompt": "Nice to meet you! 可以怎么回答？", "choices": ["Good night!", "Nice to meet you, too!", "School is over."], "answer": 1, "explanation": "too 表示「也」。"}, {"kind": "choice", "prompt": "「你叫什么名字？」怎么说？", "choices": ["How are you?", "Who is your teacher?", "What’s your name?"], "answer": 2, "explanation": "What’s your name? 用来询问名字。"}, {"kind": "choice", "prompt": "「拿着书」怎么说？", "choices": ["hold the book", "read the book", "write the word"], "answer": 0, "explanation": "hold 表示拿着。"}, {"kind": "choice", "prompt": "「坐下」怎么说？", "choices": ["say hello", "sit down", "listen to music"], "answer": 1, "explanation": "sit down 表示坐下。"}, {"kind": "choice", "prompt": "They listen ___ the teacher.", "choices": ["in", "on", "to"], "answer": 2, "explanation": "listen to 后接听的人或事物。"}, {"kind": "choice", "prompt": "School is over. 是什么意思？", "choices": ["放学了。", "上课了。", "安静。"], "answer": 0, "explanation": "School is over. 表示放学了。"}, {"kind": "choice", "prompt": "哪一句表示「请听老师讲」？", "choices": ["Listen to the teacher.", "Close the book.", "Sit down."], "answer": 0, "explanation": "listen to 表示听。"}, {"kind": "read", "prompt": "My name is Ella.", "explanation": "注意 name 和 is 连起来读。"}]}};
// Card weights are percentage points.
const CARDS = [
  {
    "id": "silverfish",
    "name": "Silverfish",
    "number": "No.001",
    "weight": 15.8,
    "rarity": "S"
  },
  {
    "id": "phantom",
    "name": "Phantom",
    "number": "No.002",
    "weight": 15.8,
    "rarity": "S"
  },
  {
    "id": "ghast",
    "name": "Ghast",
    "number": "No.003",
    "weight": 15.8,
    "rarity": "S"
  },
  {
    "id": "shulker",
    "name": "Shulker",
    "number": "No.004",
    "weight": 15.8,
    "rarity": "S"
  },
  {
    "id": "creeper",
    "name": "Creeper",
    "number": "No.005",
    "weight": 15.8,
    "rarity": "S"
  },
  {
    "id": "blaze",
    "name": "Blaze",
    "number": "No.006",
    "weight": 10,
    "rarity": "SS"
  },
  {
    "id": "enderman",
    "name": "Enderman",
    "number": "No.007",
    "weight": 10,
    "rarity": "SS"
  },
  {
    "id": "warden",
    "name": "Warden",
    "number": "No.008",
    "weight": 1,
    "rarity": "SSS"
  }
];
