import { useState, useEffect, useRef } from 'react';
import { StartProxy, StopProxy, GetProxyURL, GetStatus, GetProjectInfo, SelectProjectDirectory, SetAPIKey, GetRecentProjects, OpenRecentProject, DetectRunningPorts, DetectPortsWithInfo, StopClaudeProcessing, GetDevServerStatus, SelectDirectoryForNewProject, CreateNextProject } from "../wailsjs/go/main/App";
import { EventsOn } from "../wailsjs/runtime/runtime";
import ChatInput from './components/ChatInput';
import ImageGallery from './components/ImageGallery';
import WelcomeScreen from './components/WelcomeScreen';
import GitCheckpointModal from './components/GitCheckpointModal';
import GitHistoryModal from './components/GitHistoryModal';
import CheckpointsPanel from './components/CheckpointsPanel';
import { FolderOpen, Play, Stop, X, ArrowLeft, Gear, ClockCounterClockwise, ArrowsClockwise } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectInfo {
    projectDir: string;
    proxyPort: number;
    targetPort: number;
    serverActive: boolean;
}

interface SelectedElement {
    tagName: string;
    classes: string[];
    id: string;
    selector: string;
    bounds: {
        width: number;
        height: number;
        x: number;
        y: number;
    };
    innerText?: string;
    outerHTML?: string;
}

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

function App() {
    const [isServerActive, setIsServerActive] = useState(false);
    const [devServerURL, setDevServerURL] = useState(''); // Changed from proxyURL
    const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
    const [statusMessage, setStatusMessage] = useState('Click "Start Proxy" to begin');
    const [isLoading, setIsLoading] = useState(false);
    const [showAPIKeyDialog, setShowAPIKeyDialog] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeyError, setApiKeyError] = useState('');

    // New sidebar UX state
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isColorPickerMode, setIsColorPickerMode] = useState(false);
    const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showGitCheckpointModal, setShowGitCheckpointModal] = useState(false);
    const [showGitHistoryModal, setShowGitHistoryModal] = useState(false);
    const [showCheckpointsPanel, setShowCheckpointsPanel] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [messageHistory, setMessageHistory] = useState<Array<{
        message: string;
        timestamp: Date;
        element: string;
    }>>([]);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Target port configuration
    const [targetPortInput, setTargetPortInput] = useState('');

    // Welcome screen state
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
    const [selectedProjectForWelcome, setSelectedProjectForWelcome] = useState<{ path: string; name: string } | null>(null);
    const [detectedPorts, setDetectedPorts] = useState<PortInfo[]>([]);
    const [devServerStarting, setDevServerStarting] = useState(false);
    const [devServerPort, setDevServerPort] = useState(0);

    // IMPORTANT: Wails app should NOT connect to WebSocket
    // Only the injected code in the user's browser (inside iframe) connects to WebSocket
    // This connection status is for display purposes only - not used for actual communication
    const [isConnected, setIsConnected] = useState(false);

    // Image gallery panel state (integrated into sidebar)
    const [showImageGalleryPanel, setShowImageGalleryPanel] = useState(false);
    const [selectedImagePathForPrompt, setSelectedImagePathForPrompt] = useState<string | null>(null);

    // New project creation state
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [projectCreationProgress, setProjectCreationProgress] = useState('');
    const [showProjectNameInput, setShowProjectNameInput] = useState(false);
    const [newProjectParentDir, setNewProjectParentDir] = useState('');
    const [projectNameInput, setProjectNameInput] = useState('');
    const [projectNameError, setProjectNameError] = useState('');

    // Load initial status
    useEffect(() => {
        loadStatus();
        loadProjectInfo();
        loadRecentProjects();
    }, []);

    // Listen for project creation progress events
    useEffect(() => {
        const unsubscribe = EventsOn('project-creation-progress', (message: string) => {
            console.log('[Project Creation] Progress:', message);
            setProjectCreationProgress(message);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Poll dev server status when a project is selected
    useEffect(() => {
        if (!selectedProjectForWelcome) return;

        const pollDevServerStatus = async () => {
            try {
                const status = await GetDevServerStatus();
                const statusData = status as { starting: boolean; port: number };
                setDevServerStarting(statusData.starting);
                setDevServerPort(statusData.port);

                // If dev server is ready, auto-populate the port input
                if (!statusData.starting && statusData.port > 0) {
                    setTargetPortInput(statusData.port.toString());
                }
            } catch (error) {
                console.error('Error polling dev server status:', error);
            }
        };

        // Poll every 500ms
        const interval = setInterval(pollDevServerStatus, 500);
        pollDevServerStatus(); // Initial call

        return () => clearInterval(interval);
    }, [selectedProjectForWelcome]);

    // postMessage bridge for iframe communication
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type, payload } = event.data;

            switch (type) {
                case 'LAYRR_READY':
                    console.log('[Sidebar] Minimal inject ready');
                    setIsConnected(true); // Iframe is ready, WebSocket should be connected
                    break;
                case 'LAYRR_WS_CONNECTED':
                    console.log('[Sidebar] WebSocket connected in iframe');
                    setIsConnected(true);
                    break;
                case 'LAYRR_WS_DISCONNECTED':
                    console.log('[Sidebar] WebSocket disconnected in iframe');
                    setIsConnected(false);
                    break;
                case 'ELEMENT_SELECTED':
                    console.log('[Sidebar] Element selected:', payload);
                    setSelectedElement(payload);
                    setIsSelectionMode(false);

                    // Auto-open gallery if an IMG element is selected
                    if (payload.tagName === 'IMG') {
                        console.log('[Sidebar] IMG element detected, opening gallery in replacement mode');
                        setShowImageGalleryPanel(true);
                    }
                    break;
                case 'COLOR_PICKED':
                    console.log('[Sidebar] Color picked:', payload);
                    handleColorPicked(payload);
                    break;
                case 'MESSAGE_RESPONSE':
                    console.log('[Sidebar] 📬 === RESPONSE FROM IFRAME ===');
                    console.log('[Sidebar] Response:', payload);
                    console.log('[Sidebar] Response status:', payload.status);
                    console.log('[Sidebar] Response id:', payload.id);

                    if (payload.status === 'received') {
                        console.log('[Sidebar] 📨 Message received by backend, processing...');
                        // Don't stop spinner yet, Claude Code is still working
                    } else if (payload.status === 'complete') {
                        console.log('[Sidebar] ✅ Processing complete!');
                        handleGitCheckout();
                        setIsProcessing(false);
                        setSelectedElement(null);
                    } else if (payload.status === 'error') {
                        console.error('[Sidebar] ❌ Error:', payload.error);
                        if (payload.error && (payload.error.includes('signal: killed') || payload.error.includes('process was killed'))) {
                            setToastMessage('Change cancelled');
                        } else {
                            setStatusMessage(`Error: ${payload.error}`);
                        }
                        setIsProcessing(false);
                    } else {
                        console.warn('[Sidebar] ⚠️ Unknown status:', payload.status);
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Auto-hide toast after 3 seconds
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    // Sidebar control functions
    const handleToggleEditMode = () => {
        setIsEditMode(!isEditMode);
        setIsSelectionMode(false);
        setSelectedElement(null);
    };

    const handleClearSelection = () => {
        setSelectedElement(null);
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const handleSelectElement = () => {
        const newSelectionMode = !isSelectionMode;
        setIsSelectionMode(newSelectionMode);

        // Disable color picker mode if enabling selection mode
        if (newSelectionMode && isColorPickerMode) {
            setIsColorPickerMode(false);
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'DISABLE_COLOR_PICKER_MODE' },
                    '*'
                );
            }
        }

        // Send message to iframe to enable/disable selection mode
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                { type: newSelectionMode ? 'ENABLE_SELECTION_MODE' : 'DISABLE_SELECTION_MODE' },
                '*'
            );
        }
    };

    const handleColorPicker = () => {
        const newColorPickerMode = !isColorPickerMode;
        setIsColorPickerMode(newColorPickerMode);

        // Disable selection mode if enabling color picker mode
        if (newColorPickerMode && isSelectionMode) {
            setIsSelectionMode(false);
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'DISABLE_SELECTION_MODE' },
                    '*'
                );
            }
        }

        // Send message to iframe to enable/disable color picker mode
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                { type: newColorPickerMode ? 'ENABLE_COLOR_PICKER_MODE' : 'DISABLE_COLOR_PICKER_MODE' },
                '*'
            );
        }
    };

    const handleColorPicked = (payload: any) => {
        const { backgroundColor, textColor } = payload;

        // Copy background color to clipboard
        navigator.clipboard.writeText(backgroundColor).then(() => {
            setToastMessage(`Copied ${backgroundColor} to clipboard`);
            setIsColorPickerMode(false);
        }).catch(err => {
            console.error('Failed to copy color:', err);
            setToastMessage('Failed to copy color');
        });
    };

    const handleCaptureScreenshot = async () => {
        setIsCapturing(true);
        // TODO: Implement screenshot capture via Go backend
        setTimeout(() => {
            setIsCapturing(false);
            // Mock screenshot for now
            setScreenshot('data:image/png;base64,...');
        }, 1000);
    };

    const handleSubmitPrompt = async (prompt: string, image?: string | null, isAttachment?: boolean, imagePath?: string | null) => {
        // If image is provided, determine if it's an attachment or design analysis
        if (image) {
            if (isAttachment) {
                console.log('[Sidebar] 📎 === STARTING IMAGE ATTACHMENT ===');
                console.log('[Sidebar] Prompt:', prompt);
                console.log('[Sidebar] Image path:', imagePath);
                console.log('[Sidebar] Selected element:', selectedElement);
                console.log('[Sidebar] WebSocket connected?:', isConnected);

                // Add to message history (keep max 9)
                setMessageHistory(prev => {
                    const updated = [{
                        message: prompt,
                        timestamp: new Date(),
                        element: selectedElement ? selectedElement.tagName : 'Attachment'
                    }, ...prev];
                    return updated.slice(0, 9);
                });

                setIsProcessing(true);

                // Format message for image attachment - include selected element if available
                // Image is already saved, just send the path
                const message: any = {
                    type: 'attach-image',
                    id: Date.now(),
                    imagePath: imagePath, // Send path instead of base64
                    prompt: prompt
                };

                // Include selected element information if available
                if (selectedElement) {
                    message.area = {
                        x: Math.round(selectedElement.bounds.x),
                        y: Math.round(selectedElement.bounds.y),
                        width: Math.round(selectedElement.bounds.width),
                        height: Math.round(selectedElement.bounds.height),
                        elementCount: 1,
                        elements: [{
                            tagName: selectedElement.tagName,
                            id: selectedElement.id,
                            classes: selectedElement.classes.join(' '),
                            selector: selectedElement.selector,
                            innerText: selectedElement.innerText || '',
                            outerHTML: selectedElement.outerHTML || ''
                        }]
                    };
                }

                console.log('[Sidebar] 📦 Formatted message for image attachment:', {
                    ...message,
                    hasElement: !!selectedElement
                });

                // Send via iframe postMessage (iframe will handle WebSocket)
                if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage(
                        { type: 'SEND_ATTACHMENT_MESSAGE', payload: message },
                        '*'
                    );
                    console.log('[Sidebar] ✅ Attachment message sent to iframe');
                } else {
                    console.error('[Sidebar] ❌ Iframe not available');
                    setIsProcessing(false);
                }

                // Clear selected element after sending
                setSelectedElement(null);

                return;
            }

            // Original design analysis flow
            console.log('[Sidebar] 🖼️ === STARTING IMAGE ANALYSIS ===');
            console.log('[Sidebar] Prompt:', prompt);
            console.log('[Sidebar] Image provided:', !!image);
            console.log('[Sidebar] WebSocket connected?:', isConnected);

            // Add to message history (keep max 9)
            setMessageHistory(prev => {
                const updated = [{
                    message: prompt,
                    timestamp: new Date(),
                    element: 'Image'
                }, ...prev];
                return updated.slice(0, 9);
            });

            setIsProcessing(true);

            // Extract image type from data URL
            const imageTypeMatch = image.match(/data:(image\/[^;]+);base64,/);
            const imageType = imageTypeMatch ? imageTypeMatch[1] : 'image/png';
            const base64Data = image.replace(/^data:image\/[^;]+;base64,/, '');

            // Format message for design analysis
            const message = {
                type: 'analyze-design',
                id: Date.now(),
                image: base64Data,
                imageType: imageType,
                prompt: prompt
            };

            console.log('[Sidebar] 📦 Formatted message for vision analysis:', { ...message, image: '[base64-data]' });

            // Send via iframe postMessage (iframe will handle WebSocket)
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'SEND_VISION_MESSAGE', payload: message },
                    '*'
                );
                console.log('[Sidebar] ✅ Vision message sent to iframe');
            } else {
                console.error('[Sidebar] ❌ Iframe not available');
                setIsProcessing(false);
            }

            return;
        }

        // Original element selection flow
        if (!selectedElement) {
            console.warn('[Sidebar] ⚠️ No element selected');
            return;
        }

        console.log('[Sidebar] 🚀 === STARTING PROMPT SUBMISSION ===');
        console.log('[Sidebar] Prompt:', prompt);
        console.log('[Sidebar] Selected element:', selectedElement);
        console.log('[Sidebar] WebSocket connected?:', isConnected);

        // Add to message history (keep max 9)
        setMessageHistory(prev => {
            const updated = [{
                message: prompt,
                timestamp: new Date(),
                element: selectedElement.tagName
            }, ...prev];
            return updated.slice(0, 9);
        });

        setIsProcessing(true);

        // Check if there's a selected image from gallery - if so, use image attachment flow
        if (selectedImagePathForPrompt) {
            console.log('[Sidebar] 🖼️ Using selected image from gallery:', selectedImagePathForPrompt);

            // Format as image attachment message
            const message: any = {
                type: 'attach-image',
                id: Date.now(),
                imagePath: selectedImagePathForPrompt,
                prompt: prompt,
                area: {
                    x: Math.round(selectedElement.bounds.x),
                    y: Math.round(selectedElement.bounds.y),
                    width: Math.round(selectedElement.bounds.width),
                    height: Math.round(selectedElement.bounds.height),
                    elementCount: 1,
                    elements: [{
                        tagName: selectedElement.tagName,
                        id: selectedElement.id,
                        classes: selectedElement.classes.join(' '),
                        selector: selectedElement.selector,
                        innerText: selectedElement.innerText || '',
                        outerHTML: selectedElement.outerHTML || ''
                    }]
                }
            };

            // Send via iframe postMessage
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'SEND_ATTACHMENT_MESSAGE', payload: message },
                    '*'
                );
                console.log('[Sidebar] ✅ Image attachment message sent with gallery image');
            } else {
                console.error('[Sidebar] ❌ Iframe not available');
                setIsProcessing(false);
            }

            // Clear selected image after sending
            setSelectedImagePathForPrompt(null);
            setSelectedElement(null);
            return;
        }

        // Regular message flow (no image)
        // Format message according to bridge.Message structure
        const message = {
            id: Date.now(),
            area: {
                x: Math.round(selectedElement.bounds.x),
                y: Math.round(selectedElement.bounds.y),
                width: Math.round(selectedElement.bounds.width),
                height: Math.round(selectedElement.bounds.height),
                elementCount: 1,
                elements: [{
                    tagName: selectedElement.tagName,
                    id: selectedElement.id,
                    classes: selectedElement.classes.join(' '), // Convert array to space-separated string
                    selector: selectedElement.selector,
                    innerText: selectedElement.innerText || '',
                    outerHTML: selectedElement.outerHTML || ''
                }]
            },
            instruction: prompt,
            screenshot: screenshot || '' // Include screenshot if available
        };

        console.log('[Sidebar] 📦 Formatted message for Claude Code:', message);

        // Send via iframe postMessage (iframe will handle WebSocket)
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                { type: 'SEND_ELEMENT_MESSAGE', payload: message },
                '*'
            );
            console.log('[Sidebar] ✅ Element message sent to iframe');
        } else {
            console.error('[Sidebar] ❌ Iframe not available');
            setIsProcessing(false);
        }
    };

    const loadStatus = async () => {
        try {
            const status = await GetStatus();
            setIsServerActive(status.serverActive);
            if (status.serverActive) {
                // Use proxy port (9998) which proxies to dev server
                const info = await GetProjectInfo();
                const proxyPort = (info as ProjectInfo).proxyPort;
                setDevServerURL(`http://localhost:${proxyPort}`);
            }
        } catch (error) {
            console.error('Error loading status:', error);
        }
    };

    const loadProjectInfo = async () => {
        try {
            const info = await GetProjectInfo();
            setProjectInfo(info as ProjectInfo);
        } catch (error) {
            console.error('Error loading project info:', error);
        }
    };

    const loadRecentProjects = async () => {
        try {
            const projects = await GetRecentProjects();
            setRecentProjects(projects as RecentProject[]);
        } catch (error) {
            console.error('Error loading recent projects:', error);
        }
    };

    const handleStartProxy = async () => {
        setIsLoading(true);
        setStatusMessage('Starting proxy server...');
        try {
            // Parse target port (0 means auto-detect)
            const port = targetPortInput ? parseInt(targetPortInput, 10) : 0;

            // Use current directory (empty string means use default)
            const result = await StartProxy('', port);
            setStatusMessage(result);

            // Wait a bit for server to fully start
            setTimeout(async () => {
                await loadProjectInfo();
                const info = await GetProjectInfo();
                const proxyPort = (info as ProjectInfo).proxyPort;
                setDevServerURL(`http://localhost:${proxyPort}`);
                setIsServerActive(true);
                setIsLoading(false);
            }, 1000);
        } catch (error) {
            setStatusMessage(`Error: ${error}`);
            setIsLoading(false);
        }
    };

    const handleStopProxy = async () => {
        setIsLoading(true);
        setStatusMessage('Stopping proxy server...');
        try {
            const result = await StopProxy();
            setStatusMessage(result);
            setDevServerURL('');
            setIsServerActive(false);
            setIsLoading(false);
        } catch (error) {
            setStatusMessage(`Error: ${error}`);
            setIsLoading(false);
        }
    };

    const handleGitCheckout = () => {
        // Force iframe reload after git checkout
        if (iframeRef.current) {
            const currentSrc = iframeRef.current.src;
            iframeRef.current.src = '';
            setTimeout(() => {
                if (iframeRef.current) {
                    iframeRef.current.src = currentSrc;
                }
            }, 100);
        }
    };

    const handleSelectDirectory = async () => {
        try {
            const selectedDir = await SelectProjectDirectory();
            if (selectedDir) {
                await loadProjectInfo();
                await loadRecentProjects();
                const projectName = selectedDir.split('/').pop() || selectedDir;
                setSelectedProjectForWelcome({ path: selectedDir, name: projectName });

                // Detect running ports with folder info
                const allPortsInfo = await DetectPortsWithInfo();

                // Filter ports to only show those matching the selected project directory
                const filteredPorts = (allPortsInfo as PortInfo[]).filter(portInfo => {
                    if (!portInfo.workDir) return false;
                    // Normalize paths for comparison (workDir already has ~ expanded by backend)
                    const normalizedWorkDir = portInfo.workDir;
                    const normalizedSelectedDir = selectedDir;
                    // Only show ports whose working directory is within the selected directory
                    return normalizedWorkDir.startsWith(normalizedSelectedDir);
                });

                setDetectedPorts(filteredPorts);

                // If exactly one port found, auto-select it
                if (filteredPorts.length === 1) {
                    setTargetPortInput(filteredPorts[0].port.toString());
                } else if (filteredPorts.length === 0) {
                    setTargetPortInput('');
                }

                setStatusMessage(`Project directory: ${selectedDir}`);
            }
        } catch (error) {
            setStatusMessage(`Error selecting directory: ${error}`);
        }
    };

    const handleOpenRecentProject = async (path: string, targetPort: number) => {
        try {
            await OpenRecentProject(path, targetPort);
            await loadProjectInfo();
            await loadRecentProjects();

            // Detect running ports with folder info
            const allPortsInfo = await DetectPortsWithInfo();

            // Filter ports to only show those matching the project path
            const filteredPorts = (allPortsInfo as PortInfo[]).filter(portInfo => {
                if (!portInfo.workDir) return false;
                // Normalize paths for comparison (workDir already has ~ expanded by backend)
                const normalizedWorkDir = portInfo.workDir;
                const normalizedPath = path;
                // Only show ports whose working directory is within the selected directory
                return normalizedWorkDir.startsWith(normalizedPath);
            });

            setDetectedPorts(filteredPorts);

            // If exactly one port found, auto-select it; otherwise use saved port
            if (filteredPorts.length === 1) {
                setTargetPortInput(filteredPorts[0].port.toString());
            } else if (filteredPorts.length > 1 && targetPort > 0 && filteredPorts.some(p => p.port === targetPort)) {
                setTargetPortInput(targetPort.toString());
            } else if (filteredPorts.length > 1) {
                setTargetPortInput(''); // Let user choose
            } else {
                setTargetPortInput(targetPort > 0 ? targetPort.toString() : '');
            }

            const projectName = path.split('/').pop() || path;
            setSelectedProjectForWelcome({ path, name: projectName });
        } catch (error) {
            setStatusMessage(`Error opening project: ${error}`);
        }
    };

    const handleStartProxyFromWelcome = async (port?: string) => {
        if (!selectedProjectForWelcome) return;

        setIsLoading(true);
        setStatusMessage('Starting proxy server...');
        try {
            // Parse target port - use provided port or current input
            const targetPort = port ? parseInt(port, 10) : (targetPortInput ? parseInt(targetPortInput, 10) : 0);

            // Use the selected project path
            const result = await StartProxy(selectedProjectForWelcome.path, targetPort);
            setStatusMessage(result);

            // Wait a bit for server to fully start
            setTimeout(async () => {
                await loadProjectInfo();
                const info = await GetProjectInfo();
                const proxyPort = (info as ProjectInfo).proxyPort;
                setDevServerURL(`http://localhost:${proxyPort}`);
                setIsServerActive(true);
                setIsLoading(false);
                setSelectedProjectForWelcome(null);
            }, 1000);
        } catch (error) {
            setStatusMessage(`Error: ${error}`);
            setIsLoading(false);
        }
    };

    const handleRefreshPorts = async () => {
        if (!selectedProjectForWelcome) return;

        // Check for ports over 2 seconds
        const checkInterval = 500; // Check every 500ms
        const maxAttempts = 4; // 4 attempts = 2 seconds
        let attempts = 0;

        const checkPorts = async (): Promise<PortInfo[]> => {
            const allPortsInfo = await DetectPortsWithInfo();

            // Filter ports to only show those matching the selected project directory
            const filteredPorts = (allPortsInfo as PortInfo[]).filter(portInfo => {
                if (!portInfo.workDir) return false;
                // Normalize paths for comparison (workDir already has ~ expanded by backend)
                const normalizedWorkDir = portInfo.workDir;
                const normalizedSelectedDir = selectedProjectForWelcome.path;
                return normalizedWorkDir.startsWith(normalizedSelectedDir) ||
                       normalizedSelectedDir.startsWith(normalizedWorkDir);
            });

            return filteredPorts;
        };

        // Keep checking for ports until found or timeout
        while (attempts < maxAttempts) {
            const filteredPorts = await checkPorts();

            if (filteredPorts.length > 0) {
                setDetectedPorts(filteredPorts);

                // If exactly one port found, auto-select it
                if (filteredPorts.length === 1) {
                    setTargetPortInput(filteredPorts[0].port.toString());
                }
                return;
            }

            attempts++;
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }

        // No ports found after 2 seconds - reset
        setDetectedPorts([]);
        setTargetPortInput('');
    };

    const handleNewProject = async () => {
        try {
            // Step 1: Open directory picker for parent location
            const parentDir = await SelectDirectoryForNewProject();

            // User cancelled
            if (!parentDir) {
                return;
            }

            // Step 2: Store parent directory and show project name input
            setNewProjectParentDir(parentDir);
            setShowProjectNameInput(true);
            setProjectNameInput('');
            setProjectNameError('');
        } catch (error) {
            console.error('Error selecting directory:', error);
            setToastMessage('Failed to select directory');
        }
    };

    const validateProjectName = (name: string): string | null => {
        if (name.length < 3) {
            return 'Project name must be at least 3 characters';
        }

        // Check for invalid characters
        if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
            return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }

        return null;
    };

    const handleCreateProject = async () => {
        // Validate project name
        const normalizedName = projectNameInput.trim().replace(/\s+/g, '-').toLowerCase();
        const error = validateProjectName(normalizedName);

        if (error) {
            setProjectNameError(error);
            return;
        }

        try {
            setIsCreatingProject(true);
            setProjectCreationProgress('Initializing...');
            setProjectNameError('');

            // Call backend to create project
            const projectPath = await CreateNextProject(newProjectParentDir, normalizedName);

            // Success! Set as selected project
            setSelectedProjectForWelcome({
                path: projectPath,
                name: normalizedName
            });

            // Reset creation state
            setIsCreatingProject(false);
            setShowProjectNameInput(false);
            setProjectCreationProgress('');
            setProjectNameInput('');
            setNewProjectParentDir('');

            // Reload recent projects
            await loadRecentProjects();

            // Show success message
            setToastMessage(`Project "${normalizedName}" created successfully!`);

            // Detect ports for the new project (will happen automatically via polling)

        } catch (error) {
            console.error('Error creating project:', error);
            setIsCreatingProject(false);
            setProjectCreationProgress('');
            setToastMessage(`Failed to create project: ${error}`);

            // Return to welcome screen
            setShowProjectNameInput(false);
            setProjectNameInput('');
            setNewProjectParentDir('');
            setProjectNameError('');
        }
    };

    const handleCancelProjectCreation = () => {
        setShowProjectNameInput(false);
        setProjectNameInput('');
        setProjectNameError('');
        setNewProjectParentDir('');
        setIsCreatingProject(false);
        setProjectCreationProgress('');
    };

    const handleSaveAPIKey = async () => {
        setApiKeyError('');

        if (!apiKeyInput.trim()) {
            setApiKeyError('API key cannot be empty');
            return;
        }

        if (!apiKeyInput.startsWith('sk-ant-')) {
            setApiKeyError('API key must start with "sk-ant-"');
            return;
        }

        try {
            await SetAPIKey(apiKeyInput);
            setShowAPIKeyDialog(false);
            setApiKeyInput('');
            setStatusMessage('API key saved successfully');
        } catch (error) {
            setApiKeyError(`Error saving API key: ${error}`);
        }
    };

    // Show welcome screen whenever server is not active
    const showWelcome = !isServerActive;

    return (
        <div className="flex h-screen w-screen bg-primary font-sans text-gray-900 overflow-hidden">
            {showWelcome ? (
                /* Welcome Screen */
                <WelcomeScreen
                    recentProjects={recentProjects}
                    onOpenProject={handleSelectDirectory}
                    onOpenRecentProject={handleOpenRecentProject}
                    selectedProject={selectedProjectForWelcome}
                    onStartProxy={handleStartProxyFromWelcome}
                    targetPortInput={targetPortInput}
                    onTargetPortChange={setTargetPortInput}
                    detectedPorts={detectedPorts}
                    onRefreshPorts={handleRefreshPorts}
                    devServerStarting={devServerStarting}
                    devServerPort={devServerPort}
                    onNewProject={handleNewProject}
                    showProjectNameInput={showProjectNameInput}
                    newProjectParentDir={newProjectParentDir}
                    projectNameInput={projectNameInput}
                    projectNameError={projectNameError}
                    isCreatingProject={isCreatingProject}
                    projectCreationProgress={projectCreationProgress}
                    onProjectNameChange={setProjectNameInput}
                    onCreateProject={handleCreateProject}
                    onCancelProjectCreation={handleCancelProjectCreation}
                />
            ) : (
                <>
                    {/* Preview Panel (Left Side) */}
                    <div className="flex-1 flex items-center justify-center bg-primary relative">
                        {isServerActive && devServerURL ? (
                            <iframe
                                ref={iframeRef}
                                src={devServerURL}
                                title="App Preview"
                                className="w-full h-full border-0 bg-white"
                                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                            />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full">
                                <div className="text-center text-slate-600">
                                    <svg
                                        width="120"
                                        height="120"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className="mb-6 opacity-30 mx-auto"
                                    >
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="9" y1="9" x2="15" y2="9"></line>
                                        <line x1="9" y1="15" x2="15" y2="15"></line>
                                    </svg>
                                    <h2 className="text-2xl mb-2 text-slate-500">No Preview Available</h2>
                                    <p className="text-sm text-slate-600">Start the proxy server to see your app here</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Control Panel (Right Side) */}
                    <div className="w-[400px] bg-primary border-l border flex flex-col overflow-hidden rounded-l-xl">
                        <AnimatePresence mode="wait">
                            {showSettingsPanel ? (
                                /* Settings Panel View */
                                <motion.div
                                    key="settings"
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 20, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="flex-1 overflow-hidden flex flex-col"
                                >
                                    {/* Back Button Header */}
                                    <div className="px-4 py-3 flex items-center gap-2">
                                        <motion.button
                                            onClick={() => setShowSettingsPanel(false)}
                                            className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all"
                                            title="Back"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <ArrowLeft size={16} weight="bold" />
                                        </motion.button>
                                        <h2 className="text-sm font-semibold text-gray-900 m-0">Settings</h2>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6">
                                        {/* WebSocket Connection Status */}
                                        {isServerActive && (
                                            <div className="mb-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-xs font-medium">
                                                        <motion.span
                                                            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                                                            animate={{ scale: [1, 1.2, 1] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                        ></motion.span>
                                                        <span className={isConnected ? 'text-green-800' : 'text-red-800'}>
                                                            {isConnected ? 'Claude Code Connected' : 'Connection Lost'}
                                                        </span>
                                                    </div>
                                                    {!isConnected && (
                                                        <motion.button
                                                            onClick={() => window.location.reload()}
                                                            className="p-1.5 rounded-md text-gray-700 hover:bg-primary-dark transition-all"
                                                            title="Reconnect"
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                        >
                                                            <ArrowsClockwise size={14} weight="bold" />
                                                        </motion.button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ) : showImageGalleryPanel ? (
                                /* Image Gallery Panel View */
                                <motion.div
                                    key="images"
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 20, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="flex-1 overflow-hidden flex flex-col"
                                >
                                    <ImageGallery
                                        onBack={() => setShowImageGalleryPanel(false)}
                                        onSelectImage={(path) => {
                                            setSelectedImagePathForPrompt(path);
                                            setShowImageGalleryPanel(false);
                                            setToastMessage(`Image selected: ${path.split('/').pop()}`);
                                        }}
                                        selectedImagePath={selectedImagePathForPrompt}
                                        isReplacementMode={selectedElement?.tagName === 'IMG'}
                                        currentImagePath={
                                            selectedElement?.tagName === 'IMG'
                                                ? (() => {
                                                    // Extract src from outerHTML
                                                    const srcMatch = selectedElement.outerHTML?.match(/src=["']([^"']+)["']/);
                                                    return srcMatch ? srcMatch[1] : null;
                                                })()
                                                : null
                                        }
                                        onReplaceImage={(newPath) => {
                                            if (!selectedElement) return;

                                            // Extract current image path
                                            const srcMatch = selectedElement.outerHTML?.match(/src=["']([^"']+)["']/);
                                            const currentPath = srcMatch ? srcMatch[1] : null;

                                            if (!currentPath) {
                                                setToastMessage('Could not find current image path');
                                                return;
                                            }

                                            console.log('[Sidebar] Direct image replacement:', currentPath, '→', newPath);

                                            // Send direct image replacement message
                                            if (iframeRef.current?.contentWindow) {
                                                iframeRef.current.contentWindow.postMessage(
                                                    {
                                                        type: 'DIRECT_IMAGE_REPLACE',
                                                        payload: {
                                                            oldPath: currentPath,
                                                            newPath: newPath,
                                                            selector: selectedElement.selector,
                                                            elementInfo: {
                                                                tagName: selectedElement.tagName,
                                                                outerHTML: selectedElement.outerHTML
                                                            }
                                                        }
                                                    },
                                                    '*'
                                                );
                                            }

                                            setShowImageGalleryPanel(false);
                                            setToastMessage(`Replacing image...`);
                                            setSelectedElement(null);
                                        }}
                                    />
                                </motion.div>
                            ) : showCheckpointsPanel ? (
                                /* Checkpoints Panel View */
                                <motion.div
                                    key="checkpoints"
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 20, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="flex-1 overflow-hidden flex flex-col"
                                >
                                    {/* Back Button Header */}
                                    <div className="px-4 py-3 flex items-center gap-2">
                                        <motion.button
                                            onClick={() => setShowCheckpointsPanel(false)}
                                            className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all"
                                            title="Back"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <ArrowLeft size={16} weight="bold" />
                                        </motion.button>
                                        <h2 className="text-sm font-semibold text-gray-900 m-0">Checkpoints</h2>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <CheckpointsPanel
                                            onCheckout={handleGitCheckout}
                                            onSuccess={(message) => setToastMessage(message)}
                                        />
                                    </div>
                                </motion.div>
                            ) : (
                                /* Normal Sidebar View */
                                <motion.div
                                    key="main"
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -20, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="flex-1 flex flex-col overflow-hidden"
                                >
                                    {/* Top Header with Checkpoints, Settings and Stop */}
                                    {isServerActive && (
                                        <div className="px-4 py-3 flex items-center justify-end gap-2">
                                            <motion.button
                                                onClick={() => setShowCheckpointsPanel(true)}
                                                className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all"
                                                title="View Checkpoints"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <ClockCounterClockwise size={16} weight="bold" />
                                            </motion.button>
                                            <motion.button
                                                onClick={() => setShowSettingsPanel(true)}
                                                className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all"
                                                title="Settings"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <Gear size={16} weight="bold" />
                                            </motion.button>
                                            <motion.button
                                                onClick={handleStopProxy}
                                                disabled={isLoading}
                                                className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
                                                title="Stop Proxy"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <Stop size={16} weight="bold" />
                                            </motion.button>
                                        </div>
                                    )}

                                    <div className="flex-1 overflow-y-auto p-6">
                                        {/* Minimal status indicator */}
                                        {(isLoading || statusMessage.includes('Error')) && (
                                            <div className="bg-white rounded-lg p-3 mb-4 border border">
                                                <p className="text-gray-700 text-xs">{statusMessage}</p>
                                            </div>
                                        )}

                                        {/* Empty State - Getting Started Guide */}
                                        {messageHistory.length === 0 && !isLoading && !statusMessage.includes('Error') && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="space-y-4"
                                            >
                                                <h3 className="text-sm font-semibold text-gray-700">Getting Started</h3>
                                                <div className="space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                                            <span className="text-xs font-bold text-gray-600">1</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-700 font-medium">Select an Element</p>
                                                            <p className="text-xs text-gray-500 mt-1">Click the cursor icon below to enable element selection</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                                            <span className="text-xs font-bold text-gray-600">2</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-700 font-medium">Describe Changes</p>
                                                            <p className="text-xs text-gray-500 mt-1">Tell Claude what you want to modify about the selected element</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                                            <span className="text-xs font-bold text-gray-600">3</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-700 font-medium">See Changes Live</p>
                                                            <p className="text-xs text-gray-500 mt-1">Watch your changes appear in real-time on the preview</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                                            <span className="text-xs font-bold text-gray-600">4</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-700 font-medium">Save Checkpoints</p>
                                                            <p className="text-xs text-gray-500 mt-1">Click the clock icon above to view and switch between saved versions</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Message History */}
                                        {messageHistory.length > 0 && (
                                            <div className="space-y-3">
                                                <h3 className="text-xs font-semibold text-gray-600 mb-4">Recent Messages</h3>
                                                {messageHistory.map((item, index) => {
                                                    const timeAgo = formatTimeAgo(item.timestamp);
                                                    return (
                                                        <motion.div
                                                            key={index}
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: index * 0.05 }}
                                                            className="space-y-1"
                                                        >
                                                            <p className="text-xs text-gray-700 leading-relaxed">
                                                                {item.message.length > 80 ? item.message.substring(0, 80) + '...' : item.message}
                                                            </p>
                                                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                                                <span className="font-mono">{item.element}</span>
                                                                <span>•</span>
                                                                <span>{timeAgo}</span>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Color Picker Toast */}
                        <AnimatePresence>
                            {toastMessage && toastMessage.startsWith('Copied') && (
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 20, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    className="px-4 pt-3 pb-2"
                                >
                                    <div className="rounded-lg px-3 py-2 border border-dashed border-gray-400">
                                        <div className="flex items-center gap-2">
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: 0.1, type: "spring", stiffness: 500, damping: 15 }}
                                                className="w-5 h-5 rounded border border-gray-300"
                                                style={{ backgroundColor: toastMessage.match(/#[0-9a-fA-F]{6}/)?.[0] || '#000000' }}
                                            ></motion.div>
                                            <p className="text-xs font-medium text-gray-900 font-mono">
                                                {toastMessage.match(/#[0-9a-fA-F]{6}/)?.[0] || ''}
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2">
                                            Copied color to clipboard
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* General Toast (Checkpoints, Processing, etc.) */}
                        <AnimatePresence>
                            {toastMessage && (toastMessage.includes('Checkpoint') || toastMessage.includes('checkpoint') || toastMessage.includes('Switched to') || toastMessage.includes('Processing stopped') || toastMessage.includes('Change cancelled')) && (
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 20, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    className="px-4 pt-3 pb-2"
                                >
                                    <div className="rounded-lg px-3 py-2 border border-dashed border-gray-400">
                                        <p className="text-xs font-medium text-gray-900">
                                            {toastMessage}
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Chat Input at Bottom */}
                        {isServerActive && !showSettingsPanel && (
                            <ChatInput
                                selectedElement={selectedElement}
                                isProcessing={isProcessing}
                                isSelectionMode={isSelectionMode}
                                isColorPickerMode={isColorPickerMode}
                                showCheckpoints={showCheckpointsPanel}
                                selectedImagePath={selectedImagePathForPrompt}
                                onSelectElement={handleSelectElement}
                                onClearSelection={handleClearSelection}
                                onColorPicker={handleColorPicker}
                                onOpenImageGallery={() => setShowImageGalleryPanel(true)}
                                onClearGalleryImage={() => setSelectedImagePathForPrompt(null)}
                                onSubmitPrompt={handleSubmitPrompt}
                                onCheckpointSaved={() => {
                                    setToastMessage('Checkpoint saved successfully');
                                }}
                                onRefreshIframe={handleGitCheckout}
                                onStopProcessing={async () => {
                                    try {
                                        await StopClaudeProcessing();
                                        setIsProcessing(false);
                                        setToastMessage('Processing stopped');
                                    } catch (err) {
                                        console.error('Failed to stop processing:', err);
                                        setToastMessage('Failed to stop processing');
                                    }
                                }}
                            />
                        )}

                    </div>
                </>
            )}

            {/* API Key Dialog */}
            {showAPIKeyDialog && (
                <div
                    className="fixed inset-0 bg-black/75 flex items-center justify-center z-[1000] backdrop-blur-sm"
                    onClick={() => setShowAPIKeyDialog(false)}
                >
                    <div
                        className="bg-primary-light rounded-2xl w-[90%] max-w-[500px] border border-primary-lighter shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-6 pb-4 border-b border-primary-lighter flex justify-between items-center">
                            <h2 className="text-xl text-slate-200 m-0">Set Anthropic API Key</h2>
                            <button
                                className="bg-transparent border-0 text-slate-400 cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded transition-all hover:bg-primary-lighter hover:text-slate-200"
                                onClick={() => setShowAPIKeyDialog(false)}
                            >
                                <X size={24} weight="bold" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                Enter your Anthropic API key to enable design-to-code features.
                                <br />
                                Get your key from: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 no-underline hover:underline">console.anthropic.com</a>
                            </p>
                            <input
                                type="password"
                                className="w-full px-4 py-3 bg-primary border border-primary-lighter rounded-lg text-slate-200 text-sm font-mono transition-all focus:outline-none focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(102,126,234,0.1)] placeholder:text-slate-600"
                                placeholder="sk-ant-..."
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSaveAPIKey()}
                            />
                            {apiKeyError && (
                                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
                                    {apiKeyError}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 pb-6 flex gap-3 justify-end">
                            <button
                                className="px-6 py-2.5 bg-primary-lighter text-slate-200 text-sm font-semibold rounded-lg min-w-[100px] transition-all hover:bg-[#35322b]"
                                onClick={() => setShowAPIKeyDialog(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-6 py-2.5 bg-gradient-purple text-white text-sm font-semibold rounded-lg min-w-[100px] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(102,126,234,0.3)] active:translate-y-0"
                                onClick={handleSaveAPIKey}
                            >
                                Save API Key
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Git Checkpoint Modal */}
            <GitCheckpointModal
                show={showGitCheckpointModal}
                onClose={() => setShowGitCheckpointModal(false)}
                onSuccess={() => {
                    setToastMessage('Checkpoint saved successfully');
                }}
            />

            {/* Git History Modal */}
            <GitHistoryModal
                show={showGitHistoryModal}
                onClose={() => setShowGitHistoryModal(false)}
                onCheckout={() => {
                    handleGitCheckout();
                    setToastMessage('Switched to checkpoint');
                }}
            />
        </div>
    );
}

export default App;
