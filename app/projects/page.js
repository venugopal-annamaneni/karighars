"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  Plus,
  Search,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import KGPagination from '@/components/kg-pagination';

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      // fetchProjects();
    }
  }, [status, router]);

  useEffect(() => {
    fetchProjects();
  }, [pageNo, pageSize]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`/api/projects?page_size=${pageSize}&page_no=${pageNo}&filter=${searchTerm}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
        setFilteredProjects(data.projects);
        setTotalRecords(data.projects[0].total_records)
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };


  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage all your interior design projects
            </p>
          </div>
          <Link href="/projects/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects, customers, or project codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      fetchProjects() 
                    }}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        <div className="grid gap-4">
          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {searchTerm
                    ? 'No projects found matching your filters'
                    : 'No projects yet'}
                </p>
                {!searchTerm && (
                  <Link href="/projects/new">
                    <Button>Create Your First Project</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className='flex flex-col space-y-4'>
              {filteredProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">{project.name}</h3>
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${project.stage === 'ONBOARDING' ? 'bg-blue-100 text-blue-700' :
                                project.stage === '2D' ? 'bg-purple-100 text-purple-700' :
                                  project.stage === '3D' ? 'bg-amber-100 text-amber-700' :
                                    project.stage === 'execution' ? 'bg-green-100 text-green-700' :
                                      'bg-slate-100 text-slate-700'
                                }`}>
                                {project.stage}
                              </span>
                            </div>
                            <div className="grid md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Customer</p>
                                <p className="font-medium">{project.customer_name || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">KG Code</p>
                                <p className="font-medium">{project.project_code || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Location</p>
                                <p className="font-medium">{project.location || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Estimated Value</p>
                                <p className="font-medium text-green-700">
                                  {project.estimated_value_with_gst
                                    ? `₹${parseFloat(project.estimated_value_with_gst).toLocaleString('en-IN')}`
                                    : 'Not estimated'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="ghost" size="icon">
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <KGPagination
                totalRecords={totalRecords}
                defaultPageSize={pageSize}
                onChangeCallback={(pageNo, pageSize) => { setPageNo(pageNo) }}
                className="justify-end"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
