import re

with open("src/lib/game/actions/tasks.ts", "r") as f:
    content = f.read()

# 1. Remove the check in loadAndValidateTaskAccess
to_remove_1 = """  if (participant.status !== ParticipantStatus.ALIVE) {
    throw new GameEngineError("FORBIDDEN", "Eliminated participants cannot perform tasks");
  }"""
content = content.replace(to_remove_1, "")

# 2. Modify score in submitTaskOtp (lines 145-168)
content = re.sub(
    r"score: wasCorrect \? task\.points : existing\.score,",
    r"score: wasCorrect ? (participant.status === \"ALIVE\" ? task.points : 0) : existing.score,",
    content
)
content = re.sub(
    r"score: wasCorrect \? task\.points : null,",
    r"score: wasCorrect ? (participant.status === \"ALIVE\" ? task.points : 0) : null,",
    content
)

# 3. Remove the check in submitPuzzleTask
to_remove_2 = """    if (participant.status !== ParticipantStatus.ALIVE) {
      throw new GameEngineError("FORBIDDEN", "Eliminated participants cannot submit tasks");
    }"""
content = content.replace(to_remove_2, "")

# 4. Modify score in submitPuzzleTask
content = re.sub(
    r"score: task\.points \|\| 10,",
    r"score: participant.status === \"ALIVE\" ? (task.points || 10) : 0,",
    content
)

with open("src/lib/game/actions/tasks.ts", "w") as f:
    f.write(content)

