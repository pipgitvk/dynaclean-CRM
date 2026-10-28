"use client";

import { useState, useEffect } from "react";
import ClientTaskTable from "./ClientTaskTableAdmin";

export default function DirectorTaskManager({ currentUser }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/director/tasks`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 mx-auto">Loading...</div>;
  }

  return (
    <div className="p-6 mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 All Tasks</h1>
      </div>

      <ClientTaskTable initialTasks={tasks} currentUser={currentUser} />
    </div>
  );
}
