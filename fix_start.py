import re

with open("src/app/api/game/room/start/route.ts", "r") as f:
    content = f.read()

old_task_loop = """      for (const p of participants) {
        // Randomly select 10 tasks (or fewer if total is less than 10)
        const shuffledTasks = [...allGameTasks].sort(() => 0.5 - Math.random());
        const assignedTasks = shuffledTasks.slice(0, 10);
        
        for (const task of assignedTasks) {
          await tx.participantTask.upsert({
            where: { participantId_taskId: { participantId: p.id, taskId: task.id } },
            update: {},
            create: {
              participantId: p.id,
              taskId: task.id,
              status: ParticipantTaskStatus.AVAILABLE,
            },
          });
        }
      }"""

new_task_loop = """      for (const p of participants) {
        const isImposter = imposterIds.has(p.id);
        // Filter tasks based on role
        const eligibleTasks = allGameTasks.filter(t => t.forImposter === isImposter);
        
        // Randomly select 10 tasks (or fewer if total is less than 10)
        const shuffledTasks = [...eligibleTasks].sort(() => 0.5 - Math.random());
        const assignedTasks = shuffledTasks.slice(0, 10);
        
        for (const task of assignedTasks) {
          await tx.participantTask.upsert({
            where: { participantId_taskId: { participantId: p.id, taskId: task.id } },
            update: {},
            create: {
              participantId: p.id,
              taskId: task.id,
              status: ParticipantTaskStatus.AVAILABLE,
            },
          });
        }
      }"""

content = content.replace(old_task_loop, new_task_loop)

with open("src/app/api/game/room/start/route.ts", "w") as f:
    f.write(content)

