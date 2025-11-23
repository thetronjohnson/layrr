import React from 'react';
import { FolderOpen, GithubLogo, ArrowClockwise } from '@phosphor-icons/react';

interface RecentProject {
  path: string;
  name: string;
  lastOpened: string;
  targetPort: number;
}

interface PortInfo {
  port: number;
  processName: string;
  workDir: string;
  pid: number;
}

interface WelcomeScreenProps {
  recentProjects: RecentProject[];
  onOpenProject: () => void;
  onOpenRecentProject: (path: string, targetPort: number) => void;
  selectedProject: { path: string; name: string } | null;
  onStartProxy: (port?: string) => void;
  targetPortInput: string;
  onTargetPortChange: (port: string) => void;
  detectedPorts: PortInfo[];
  onRefreshPorts?: () => Promise<void>;
  devServerStarting?: boolean;
  devServerPort?: number;
}

export default function WelcomeScreen({
  recentProjects,
  onOpenProject,
  onOpenRecentProject,
  selectedProject,
  onStartProxy,
  targetPortInput,
  onTargetPortChange,
  detectedPorts,
  onRefreshPorts,
  devServerStarting = false,
  devServerPort = 0
}: WelcomeScreenProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (!onRefreshPorts) return;
    setIsRefreshing(true);
    await onRefreshPorts();
    setIsRefreshing(false);
  };

  return (
    <div className="flex items-center justify-center w-full h-full bg-primary">
      <div className="w-full max-w-[600px] px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#171717] mb-3">
            LAYRR
          </h1>
          <p className="text-gray-600 text-sm">Pro · Settings</p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Open Project */}
          <button
            onClick={onOpenProject}
            className="bg-primary hover:bg-primary-dark rounded-xl p-6 text-center transition-all border border group"
          >
            <div className="flex flex-col items-center gap-3">
              <FolderOpen size={32} weight="duotone" className="text-gray-700" />
              <span className="text-gray-900 text-sm font-medium">Open project</span>
            </div>
          </button>

          {/* Connect to GitHub (Coming Soon) */}
          <button
            disabled
            className="bg-primary rounded-xl p-6 text-center border border opacity-50 cursor-not-allowed relative"
          >
            <div className="flex flex-col items-center gap-3">
              <GithubLogo size={32} weight="duotone" className="text-gray-700" />
              <span className="text-gray-900 text-sm font-medium">Connect to GitHub</span>
            </div>
            <div className="absolute top-2 right-2">
              <span className="text-[10px] bg-purple-600/20 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                Coming Soon
              </span>
            </div>
          </button>
        </div>

        {/* Selected Project Info */}
        {selectedProject && (
          <div className="rounded-lg p-4 mb-6">
            <div className="space-y-3">
              <div>
                <p className="text-gray-700 text-xs mb-1">Selected Project</p>
                <p className="text-gray-900 text-sm font-medium">{selectedProject.name}</p>
                <p className="text-gray-600 text-xs font-mono mt-1">{selectedProject.path}</p>
              </div>

              {/* Detected Ports or Port Input */}
              <div>
                <label className="block text-gray-700 text-xs mb-1.5">
                  Source Port{' '}
                  {detectedPorts.length === 0 && !devServerStarting && <span className="text-gray-500">(optional)</span>}
                </label>

                {/* Show dev server starting status */}
                {devServerStarting ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ArrowClockwise size={16} className="animate-spin text-purple-600" />
                      <span className="text-gray-700 text-sm">Starting dev server...</span>
                    </div>
                  </div>
                ) : devServerPort > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-900 text-sm font-mono">
                        :{devServerPort}
                      </span>
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onStartProxy(devServerPort.toString());
                        }}
                        className="text-gray-900 text-sm cursor-pointer hover:opacity-70 transition-opacity"
                      >
                        Open
                      </span>
                    </div>
                  </div>
                ) : detectedPorts.length > 0 ? (
                  <div className="space-y-2">
                    {detectedPorts.map((portInfo) => (
                      <div key={portInfo.port} className="flex items-center justify-between gap-3">
                        <span className="text-gray-900 text-sm font-mono">
                          :{portInfo.port}
                        </span>
                        <span
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onStartProxy(portInfo.port.toString());
                          }}
                          className="text-gray-900 text-sm cursor-pointer hover:opacity-70 transition-opacity"
                        >
                          Open
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-gray-600 text-xs">
                      Please start your development server
                    </p>
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="w-full flex items-center justify-center gap-2 bg-primary border border rounded-md py-2 px-3 text-sm text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
                    >
                      <ArrowClockwise
                        size={16}
                        className={isRefreshing ? 'animate-spin' : ''}
                      />
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div className="rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-900 text-sm font-medium">Recent projects</h3>
              <span className="text-gray-600 text-xs">View all ({recentProjects.length})</span>
            </div>
            <div className="space-y-1">
              {recentProjects.slice(0, 5).map((project, index) => (
                <button
                  key={index}
                  onClick={() => onOpenRecentProject(project.path, project.targetPort)}
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-primary-dark transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-medium truncate">
                        {project.name}
                      </p>
                      <p className="text-gray-600 text-xs truncate">~/{project.path.split('/').slice(-2).join('/')}</p>
                    </div>
                    {project.targetPort > 0 && (
                      <span className="text-gray-600 text-xs font-mono ml-2">
                        :{project.targetPort}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Recent Projects Message */}
        {recentProjects.length === 0 && !selectedProject && (
          <div className="rounded-lg p-8 text-center">
            <p className="text-gray-600 text-sm mb-1">No recent projects yet</p>
            <p className="text-gray-500 text-xs">
              Click "Open project" to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
