import re

with open("src/app/admin/page.tsx", "r") as f:
    content = f.read()

handle_create_old = """      const data = await res.json();
      if (data.success) {
        setTasks([data.task, ...tasks]);
        setTitle("");
        setDescription("");
        setPointsVal(10);
        setRequiresPhoto(false);
        setRequiresAnswer(false);
        setForImposter(false);
      }"""

handle_create_new = """      const data = await res.json();
      if (data.success) {
        setTasks([data.task, ...tasks]);
        setTitle("");
        setDescription("");
        setPointsVal(10);
        setRequiresPhoto(false);
        setRequiresAnswer(false);
        setForImposter(false);
      } else {
        alert("Failed to inject task: " + (data.message || data.error || "Unknown error (Did you update the database?)"));
      }"""

content = content.replace(handle_create_old, handle_create_new)

with open("src/app/admin/page.tsx", "w") as f:
    f.write(content)

