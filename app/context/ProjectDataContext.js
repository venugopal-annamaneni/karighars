"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { toast } from "sonner";

const ProjectDataContext = createContext();

export function ProjectDataProvider({ projectId, children }) {
  const [project, setProject] = useState(null);
  const [estimation, setEstimation] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");

      const data = await res.json();
      setProject({
        ...data.project,
        payments_received: data.payments_received,
        payments_made: data.payments_made
      });
      setEstimation(data.estimation);
    } catch (err) {
      console.error("Error fetching project data:", err);
      toast.error("Failed to reload project data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return (
    <ProjectDataContext.Provider value={{ project, estimation, loading, fetchProjectData }}>
      {children}
    </ProjectDataContext.Provider>
  );
}

export function useProjectData() {
  return useContext(ProjectDataContext);
}
