import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  oauth: vi.fn().mockResolvedValue({ error: null }),
  onboarding:vi.fn().mockResolvedValue({data:{password_required:false},error:null}),
  state: { user: null as null | { id: string }, isLoading: false, isSuperAdmin: false },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: () => unknown }) => ({ ...options, useSearch: () => ({}) }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => mocks.navigate,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.state }));
vi.mock('@/lib/supabase-client', () => ({ supabase: { auth: { signInWithOAuth: mocks.oauth },from:()=>({select:()=>({eq:()=>({maybeSingle:mocks.onboarding})})}) } }));
vi.mock('@/components/registration/RegistrationWizard', () => ({ RegistrationWizard: () => null }));

import { AuthPage } from '@/routes/auth';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.state = { user: null, isLoading: false, isSuperAdmin: false };
  mocks.onboarding.mockResolvedValue({data:{password_required:false},error:null});
});

describe('Supabase account sign-in', () => {
  it('requires invited users to set a password before normal navigation',async()=>{
    mocks.state={user:{id:'invited-user'},isLoading:false,isSuperAdmin:false};
    mocks.onboarding.mockResolvedValue({data:{password_required:true},error:null});render(<AuthPage/>);
    await waitFor(()=>expect(mocks.navigate).toHaveBeenCalledWith({to:'/set-password',replace:true}));
    expect(mocks.navigate).not.toHaveBeenCalledWith({to:'/account',replace:true});
  });
  it('sends the requested administrator to /admin after roles load', async () => {
    mocks.state = { user: { id: '25abb0d6-3fa5-48dd-85f0-4ebbaea48a27' }, isLoading: false, isSuperAdmin: true };
    render(<AuthPage />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/admin', replace: true }));
  });

  it('does not give a non-admin account the admin destination', async () => {
    mocks.state = { user: { id: 'ordinary-user' }, isLoading: false, isSuperAdmin: false };
    render(<AuthPage />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/account', replace: true }));
    expect(mocks.navigate).not.toHaveBeenCalledWith({ to: '/admin', replace: true });
  });

  it('waits for verified role loading before choosing a destination', () => {
    mocks.state = { user: { id: '25abb0d6-3fa5-48dd-85f0-4ebbaea48a27' }, isLoading: true, isSuperAdmin: false };
    render(<AuthPage />);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('uses external Supabase OAuth with a public same-origin callback', async () => {
    const page = render(<AuthPage />);
    fireEvent.click(page.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mocks.oauth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: window.location.origin + '/auth' } }));
  });
});