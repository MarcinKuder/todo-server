import { Hono } from "@hono/hono";

const app = new Hono();
const kv = await Deno.openKv();

interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

app.get("/tasks", async (c) => {
  const tasks: Deno.KvEntry<Task>[] = await Array.fromAsync(
      kv.list({ prefix: ["tasks"] }),
  );
  const hideDone = c.req.query("hideDone") === "true";
  return c.json(
      tasks
          .filter((task) => !hideDone || !task.value.done)
          .map((task) => task.value),
  );
});

app.get("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const task = await kv.get(["tasks", id]);
  if (task.value === null) {
    return c.json({ message: "Task not found" }, 404);
  }
  return c.json(task.value);
});

app.post("/tasks", async (c) => {
  try {
    let { title, priority } = await c.req.json();
    if (typeof title !== "string") {
      throw new Error("Name is required");
    }
    const task: Task = {
      id: crypto.randomUUID(),
      title: title,
      done: false,
      priority: priority || 1,
      createdAt: new Date().toISOString(),
    };
    await kv.set(["tasks", task.id], task);
    return c.json({
      message: `Task "${title}" has been added to the list!`,
    });
  } catch (e: any) {
    return c.json({ message: `Error: ${e.message}` }, 400);
  }
});
app.delete("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const task = await kv.get(["tasks", id]);
  if (task.value !== null) {
    await kv.delete(["tasks", id]);
    return c.json({
      message: `Task has been deleted!`,
    });
  }
  return c.json({ message: "Task not found" }, 404);
});

app.put("/tasks/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existingTask = (await kv.get(["tasks", id])).value as Task;
    if (existingTask === null) {
      return c.json({ message: "Task not found" }, 404);
    }
    let updatedTask = await c.req.json();
    updatedTask = {
      ...existingTask,
      ...updatedTask,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(["tasks", id], updatedTask);
    return c.json({ message: `Task updated!` });
  } catch (e: any) {
    return c.json({ message: `Error: ${e.message}` }, 400);
  }
});

app.delete("/tasks", async (c) => {
  const tasks: Deno.KvListIterator<Task> = kv.list({ prefix: ["tasks"] });
  if (!(c.req.query("key") === "secret")) {
    return c.json({ message: "unauthorized" }, 401);
  }
  for await (const task of tasks) {
    await kv.delete(["tasks", task.value.id]);
  }
  return c.json({ message: "all tasks have been deleted!" });
});

Deno.serve(app.fetch);
