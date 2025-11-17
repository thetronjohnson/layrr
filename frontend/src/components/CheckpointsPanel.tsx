import { useState, useEffect } from 'react';
import { FloppyDisk, Clock, CheckCircle, MagnifyingGlass, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { GetGitCommitHistory, SwitchToGitCommit, GetCurrentGitCommit, CreateGitCheckpoint } from '../../wailsjs/go/main/App';
import { motion, AnimatePresence } from 'framer-motion';

interface Commit {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
}

interface CheckpointsPanelProps {
    onCheckout: () => void; // Callback to refresh iframe
    onSuccess: (message: string) => void; // Callback for toast messages
}

export default function CheckpointsPanel({ onCheckout, onSuccess }: CheckpointsPanelProps) {
    const [commits, setCommits] = useState<Commit[]>([]);
    const [currentCommitHash, setCurrentCommitHash] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [switchingHash, setSwitchingHash] = useState('');
    const [error, setError] = useState('');

    // Save checkpoint state
    const [checkpointMessage, setCheckpointMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 9;

    useEffect(() => {
        loadCommits();
    }, []);

    const loadCommits = async () => {
        setIsLoading(true);
        setError('');
        try {
            const [history, currentHash] = await Promise.all([
                GetGitCommitHistory(50),
                GetCurrentGitCommit()
            ]);
            setCommits(history);
            setCurrentCommitHash(currentHash);
        } catch (err) {
            setError(`Failed to load commits: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckout = async (commitHash: string, commitShortHash: string) => {
        setSwitchingHash(commitShortHash);
        setIsSwitching(true);
        setError('');
        try {
            await SwitchToGitCommit(commitHash);
            await loadCommits(); // Reload to update current commit indicator
            onCheckout(); // Trigger iframe refresh
            onSuccess('Switched to checkpoint');
        } catch (err) {
            setError(`Failed to switch commit: ${err}`);
        } finally {
            setIsSwitching(false);
            setSwitchingHash('');
        }
    };

    const handleSaveCheckpoint = async () => {
        if (!checkpointMessage.trim()) {
            setError('Please enter a checkpoint message');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            await CreateGitCheckpoint(checkpointMessage);
            setCheckpointMessage('');
            await loadCommits(); // Reload commits list
            onSuccess('Checkpoint saved successfully');
        } catch (err) {
            setError(`Failed to create checkpoint: ${err}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSaveCheckpoint();
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Filter commits by search query
    const filteredCommits = commits.filter(commit =>
        commit.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        commit.shortHash.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Reset to page 1 when search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredCommits.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCommits = filteredCommits.slice(startIndex, endIndex);

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const goToPrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Search Bar */}
            <div className="px-4 pt-4 pb-2">
                <div className="relative">
                    <MagnifyingGlass size={14} weight="bold" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search checkpoints..."
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-xs text-black placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:shadow-[0_0_0_2px_rgba(102,126,234,0.1)]"
                    />
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mx-4 mt-4 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 text-[10px]">
                    {error}
                </div>
            )}

            {/* Checkpoint History */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : filteredCommits.length === 0 && commits.length > 0 ? (
                    <div className="text-center py-8">
                        <MagnifyingGlass size={32} weight="thin" className="text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-xs">No checkpoints match your search</p>
                    </div>
                ) : filteredCommits.length === 0 ? (
                    <div className="text-center py-8">
                        <FloppyDisk size={32} weight="thin" className="text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-xs">No checkpoints yet</p>
                    </div>
                ) : (
                    <>
                        {/* Pagination Controls - Moved to top */}
                        {totalPages > 1 && (
                            <div className="mb-3 flex items-center justify-end gap-2 text-xs text-gray-600">
                                <span className="text-gray-500">
                                    {currentPage}/{totalPages}
                                </span>
                                <button
                                    onClick={goToPrevPage}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    title="Previous page"
                                >
                                    <CaretLeft size={14} weight="bold" />
                                </button>
                                <button
                                    onClick={goToNextPage}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    title="Next page"
                                >
                                    <CaretRight size={14} weight="bold" />
                                </button>
                            </div>
                        )}

                        <motion.div
                            className="space-y-2"
                            initial="hidden"
                            animate="visible"
                            variants={{
                                visible: {
                                    transition: {
                                        staggerChildren: 0.05
                                    }
                                }
                            }}
                        >
                            {paginatedCommits.map((commit, index) => {
                            const isCurrentCommit = commit.hash === currentCommitHash;
                            // Truncate message to max 40 characters
                            const truncatedMessage = commit.message.length > 40
                                ? commit.message.substring(0, 40) + '...'
                                : commit.message;

                            return (
                                <motion.div
                                    key={commit.hash}
                                    variants={{
                                        hidden: { opacity: 0, y: 20 },
                                        visible: { opacity: 1, y: 0 }
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`px-3 py-2.5 rounded-lg border-2 border-dashed transition-all cursor-pointer group ${
                                        isCurrentCommit
                                            ? 'border-black'
                                            : 'border-gray-300 hover:border-gray-600'
                                    } ${
                                        isSwitching && switchingHash === commit.shortHash ? 'opacity-50' : ''
                                    }`}
                                    onClick={() => !isSwitching && handleCheckout(commit.hash, commit.shortHash)}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        {/* Left: Title with optional check icon */}
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {isCurrentCommit && (
                                                <motion.div
                                                    initial={{ scale: 0, rotate: -180 }}
                                                    animate={{ scale: 1, rotate: 0 }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                                >
                                                    <CheckCircle size={12} weight="fill" className="text-black flex-shrink-0" />
                                                </motion.div>
                                            )}
                                            <p className={`text-xs font-medium ${
                                                isCurrentCommit
                                                    ? 'text-black'
                                                    : 'text-gray-900 group-hover:text-gray-700'
                                            }`}>
                                                {truncatedMessage}
                                            </p>
                                        </div>

                                        {/* Right: Hash and Time */}
                                        <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-shrink-0">
                                            {isSwitching && switchingHash === commit.shortHash ? (
                                                <div className="animate-spin w-3 h-3 border border-purple-500 border-t-transparent rounded-full"></div>
                                            ) : (
                                                <>
                                                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                                        {commit.shortHash}
                                                    </span>
                                                    <span className="flex items-center gap-0.5">
                                                        <Clock size={10} weight="bold" />
                                                        {formatDate(commit.date)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                        </motion.div>
                    </>
                )}
            </div>
        </div>
    );
}
