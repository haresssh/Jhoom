import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import LeftMeeting from './LeftMeeting';

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
    useSearchParams: vi.fn(),
  };
});

describe('LeftMeeting Component', () => {
  const mockNavigate = vi.fn();
  const mockSetSearchParams = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
    (useParams as any).mockReturnValue({ roomId: 'test-room-123' });
    
    // Default global fetch mock
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Voluntary Leave state successfully when room is active', async () => {
    // Mock active room metadata API response
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        roomName: 'Daily Sync',
        description: 'Standup update'
      })
    });

    // Mock search params showing no ended reason
    (useSearchParams as any).mockReturnValue([new URLSearchParams(''), mockSetSearchParams]);

    render(
      <MemoryRouter>
        <LeftMeeting />
      </MemoryRouter>
    );

    // Verify loading spinner is shown first, then removed
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Verify Voluntary Leave title and room names are rendered
    expect(screen.getByText('You left the meeting')).toBeInTheDocument();
    expect(screen.getByText('Daily Sync')).toBeInTheDocument();
    expect(screen.getByText('Standup update')).toBeInTheDocument();
    expect(screen.getByText('You can rejoin this meeting if it is still in progress.')).toBeInTheDocument();

    // Verify Rejoin Meeting button and Go Home button are rendered
    const rejoinButton = screen.getByRole('button', { name: /Rejoin Meeting/i });
    const homeButton = screen.getByRole('button', { name: /Return to Home Screen/i });
    expect(rejoinButton).toBeInTheDocument();
    expect(homeButton).toBeInTheDocument();

    // Test clicking rejoin
    fireEvent.click(rejoinButton);
    expect(mockNavigate).toHaveBeenCalledWith('/room/test-room-123');

    // Test clicking home
    fireEvent.click(homeButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders Host Ended Call state successfully when reason=ended parameter is set', async () => {
    // Mock room metadata (even if active, ended query parameter takes precedence)
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        roomName: 'Daily Sync',
        description: 'Standup update'
      })
    });

    // Mock query params having reason=ended
    (useSearchParams as any).mockReturnValue([new URLSearchParams('reason=ended'), mockSetSearchParams]);

    render(
      <MemoryRouter>
        <LeftMeeting />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Verify Host Ended Call elements
    expect(screen.getByText('Meeting Ended')).toBeInTheDocument();
    expect(screen.getByText('The host has ended this meeting session for all participants.')).toBeInTheDocument();
    expect(screen.queryByText('Daily Sync')).not.toBeInTheDocument();

    // Verify rejoin button is hidden, only Return to Home is shown
    expect(screen.queryByRole('button', { name: /Rejoin Meeting/i })).not.toBeInTheDocument();
    const homeButton = screen.getByRole('button', { name: /Return to Home Screen/i });
    expect(homeButton).toBeInTheDocument();

    fireEvent.click(homeButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders Host Ended Call state when room is inactive (metadata returns 404)', async () => {
    // Mock room metadata returning 404 (room ended/inactive)
    (globalThis.fetch as any).mockResolvedValue({
      ok: false
    });

    (useSearchParams as any).mockReturnValue([new URLSearchParams(''), mockSetSearchParams]);

    render(
      <MemoryRouter>
        <LeftMeeting />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Verify Host Ended Call elements due to 404 metadata
    expect(screen.getByText('Meeting Ended')).toBeInTheDocument();
    expect(screen.getByText('The host has ended this meeting session for all participants.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rejoin Meeting/i })).not.toBeInTheDocument();
  });
});
