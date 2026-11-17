import { VisitorChat } from './VisitorChat';
import React, { useState } from 'react';
import ContactSection from './ContactSection';
import { MobileNavigation } from '@/components/common/MobileNavigation';
import { Button } from '@/components/ui/button';
import phamacyownerImg from '@/assets/swahivo/phamacy_owner.webp';
import pharmacistImg from '@/assets/swahivo/pharmacist.webp';
import cashierImg from '@/assets/swahivo/cashier.webp';
import managerImg from '@/assets/swahivo/manager.webp';
import accountantImg from '@/assets/swahivo/accountant.webp';
import supplierImg from '@/assets/swahivo/supplier.webp';
import deliveryriderImg from '@/assets/swahivo/delivery_rider.webp';
import herosectionphotoImg from '@/assets/swahivo/hero_section_photo.webp';
import aboutsectionImg from '@/assets/swahivo/about_section.webp';
import laptopdashboardImg from '@/assets/swahivo/laptop_dashboard.webp';
import {
  Sparkles,
  CheckCircle2,
  Building2,
  Users,
  Pill,
  TrendingUp,
  ShieldCheck,
  TrendingDown,
  Boxes,
  HeartHandshake,
  Bot,
  Warehouse,
  ShoppingCart,
  Receipt,
  LineChart,
  Network,
  Truck,
  WifiOff,
  ArrowRight,
  PhoneCall,
  Check,
  ChevronRight,
  Layers,
  Search,
  ExternalLink
} from 'lucide-react';
import { SubscriptionPlan } from '@/lib/pharmacy-types';
import { formatNumber } from '@/lib/utils';
import { BRAND, telHref } from '@/lib/brand';
import { TRIAL_DAYS, formatTokens, yearlyPrice } from '@/lib/billing';

interface LandingPageProps {
  onOpenDashboard: () => void;
  onChoosePlan: (planSlug: string) => void;
  onSignIn: () => void;
  isSignedIn: boolean;
  plans: SubscriptionPlan[];
  stats: {
    pharmacies: string;
    suppliers: string;
    medicines: string;
    accuracy: string;
  };
}

export default function LandingPage({ onOpenDashboard, onChoosePlan, onSignIn, isSignedIn, plans, stats }: LandingPageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const goContact = () => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });

  const roles = [
    {
      title: 'Pharmacy Owner',
      desc: 'Manage branches, team, performance and growth.',
      img: phamacyownerImg
    },
    {
      title: 'Pharmacist',
      desc: 'Dispense safely, manage prescriptions and ensure compliance.',
      img: pharmacistImg
    },
    {
      title: 'Cashier',
      desc: 'Process sales, handle payments and shifts accurately.',
      img: cashierImg
    },
    {
      title: 'Manager',
      desc: 'Oversee operations, stock, staff and reports.',
      img: managerImg
    },
    {
      title: 'Accountant',
      desc: 'Track finances, payments and financial reports.',
      img: accountantImg
    },
    {
      title: 'Supplier',
      desc: 'Receive orders, confirm supply and manage deliveries.',
      img: supplierImg
    },
    {
      title: 'Delivery Rider',
      desc: 'View assigned orders, update delivery status and collect proof.',
      img: deliveryriderImg
    }
  ];

  const features = [
    {
      title: 'AI Prescription Assistant',
      desc: 'Read a prescription photo, PDF or supported voice input; review written doses, catalogue matches and available stock.',
      icon: Bot,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      title: 'Smart Stock & Inventory',
      desc: 'Recorded stock, batch expiry tracking (12, 6, 3 months), low-stock alerts and reorder suggestions.',
      icon: Warehouse,
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      title: 'Purchases & Supplier Orders',
      desc: 'Create orders, get supplier alerts, track deliveries and import bulk medicine with AI data mapping.',
      icon: ShoppingCart,
      color: 'bg-indigo-50 text-indigo-600'
    },
    {
      title: 'Point of Sale (POS)',
      desc: 'Fast, reliable sales, multiple payments, shift control and sales summaries.',
      icon: Receipt,
      color: 'bg-cyan-50 text-cyan-600'
    },
    {
      title: 'AI Business Analytics',
      desc: 'Analyze sales, profit, top medicines, slow-moving stock and forecast demand.',
      icon: LineChart,
      color: 'bg-violet-50 text-violet-600'
    },
    {
      title: 'Multi-Pharmacy & Roles',
      desc: 'Add multiple branches and manage owners, managers, pharmacists, cashiers, accountants and delivery riders.',
      icon: Network,
      color: 'bg-sky-50 text-sky-600'
    },
    {
      title: 'Delivery Management',
      desc: 'Assign delivery orders, follow recorded delivery stages and update customer status.',
      icon: Truck,
      color: 'bg-amber-50 text-amber-600'
    },
    {
      title: 'Connected Operations',
      desc: 'Save sales and stock changes securely while connected. Internet access is required for transactions and AI.',
      icon: WifiOff,
      color: 'bg-rose-50 text-rose-600'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-500 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 grid grid-cols-[minmax(0,1fr)_auto] xl:flex items-center justify-between gap-3">
          {/* Logo */}
          <a href="/" className="flex items-center min-w-0"><img src={BRAND.logoUrl} alt="Afyadawa" className="h-auto max-h-11 w-auto max-w-[180px]" /></a>

          {/* Nav Links */}
          <nav className="hidden xl:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#home" className="text-blue-600 hover:text-blue-700 transition-colors">
              Home
            </a>
            <a href="#features" className="hover:text-blue-600 transition-colors">
              Features
            </a>
            <a href="#about" className="hover:text-blue-600 transition-colors">
              Solutions
            </a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">
              Pricing
            </a>
            <a href="#ecosystem" className="hover:text-blue-600 transition-colors">
              Resources
            </a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">
              Contact
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <MobileNavigation title="Swahivo navigation">
              <nav className="flex flex-col gap-1 p-5 text-sm font-semibold">
                <img src={BRAND.logoUrl} alt="Afyadawa" className="w-44 h-auto mb-5" />
                {[['home', 'Home'], ['features', 'Features'], ['about', 'Solutions'], ['pricing', 'Pricing'], ['ecosystem', 'Resources'], ['contact', 'Contact']].map(([id, label]) => (
                  <a key={id} href={`#${id}`} className="px-3 py-3 rounded-md hover:bg-accent">{label}</a>
                ))}
                <Button variant="outline" onClick={isSignedIn ? onOpenDashboard : onSignIn}>{isSignedIn ? 'Dashboard' : 'Sign In'}</Button>
                {!isSignedIn && <Button onClick={onSignIn}>Get Started Free <ArrowRight /></Button>}
              </nav>
            </MobileNavigation>
            <div className="hidden xl:flex items-center gap-3">
            <button
              onClick={isSignedIn ? onOpenDashboard : onSignIn}
              className="text-sm font-semibold text-slate-700 hover:text-blue-600 px-3 py-2 transition-colors"
            >
              {isSignedIn ? 'Dashboard' : 'Sign In'}
            </button>
            {!isSignedIn && <button
              onClick={onSignIn}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              Get Started Free
            </button>}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50/40">
        {/* Full-bleed pharmacist photo on the right */}
        <div className="absolute inset-y-0 right-0 w-[58%] hidden xl:block">
          <img
            src={herosectionphotoImg}
            alt="Swahivo Pharmacist"
            className="absolute inset-0 w-full h-full object-cover object-top"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-28 lg:min-h-[560px]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Content */}
            <div className="md:col-span-6 min-w-0 space-y-6 pt-4">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-semibold tracking-wide border border-blue-200">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>AI-Powered Pharmacy Management</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-4xl xl:text-[56px] font-extrabold text-blue-950 tracking-tight leading-[1.12]">
                Run Your Pharmacy <br />
                Smarter with <span className="text-blue-600">AI</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg text-slate-600 max-w-xl leading-relaxed">
                A complete pharmacy management system for pharmacies, chains and suppliers.
                Manage stock, sales, prescriptions, expiry, orders and deliveries in one connected workspace.
              </p>

              {/* CTAs */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2">
                <Button onClick={onOpenDashboard} className="hero-primary-action h-12 min-w-0 px-2 xl:px-5 text-xs sm:text-sm font-bold">
                  {isSignedIn ? 'Dashboard' : 'Start Free Trial'} <ArrowRight />
                </Button>
                <Button variant="outline" onClick={goContact} className="hero-secondary-action h-12 min-w-0 px-2 xl:px-5 text-xs sm:text-sm font-bold">
                  <PhoneCall /> Contact Sales
                </Button>
              </div>

              {/* Highlights */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Multi-Branch</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Connected workspace</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>AI Insights</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Secure & Reliable</span>
                </div>
              </div>
            </div>

            {/* Right: photo is the section background; AI card floats top-right */}
            <div className="md:col-span-6 relative min-w-0 xl:min-h-[420px]">
              <img src={herosectionphotoImg} alt="Swahivo Pharmacist" className="xl:hidden w-full rounded-3xl object-cover object-top aspect-[4/5]" referrerPolicy="no-referrer" />
              <div>
                {/* Floating AI Assistant Card */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md p-5 rounded-3xl shadow-xl border border-white w-[270px] max-w-[calc(100%-2rem)] z-10 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">AI Assistant</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-blue-600 shrink-0 stroke-[3]" />
                      <span>Analyze prescriptions (STT / TTT)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-blue-600 shrink-0 stroke-[3]" />
                      <span>Check stock & availability</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-blue-600 shrink-0 stroke-[3]" />
                      <span>Predict expiry & loss risk</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-blue-600 shrink-0 stroke-[3]" />
                      <span>Recommend what to reorder</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="relative z-10 -mt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-slate-100 p-3 md:divide-x divide-slate-200">
            <div className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {stats.pharmacies}
              </div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">Branch workspaces</div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {stats.suppliers}
              </div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">Supplier orders</div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                <Pill className="w-6 h-6" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {stats.medicines}
              </div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">Stock control</div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {stats.accuracy}
              </div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">Inventory records</div>
            </div>

            <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-4 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">Covlo AI</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">Supported</div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Photo of Modern Pharmacy */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden shadow-xl border-4 border-white aspect-[4/3]">
                <img
                  src={aboutsectionImg}
                  alt="Modern Swahivo Pharmacy"
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Right Information */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5" />
                <span>About Swahivo</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
                A Modern, AI-Driven Pharmacy Platform for Growth
              </h2>

              <p className="text-base text-slate-600 leading-relaxed">
                Digitize your pharmacy operations, improve patient service, reduce expiries, and make
                smarter purchasing and sales decisions with real-time data and AI.
              </p>

              {/* 4 Pillars */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">Higher Sales</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Smart basket and prescription analytics</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">Lower Losses</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Expiry control (12, 6, 3 months)</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">Efficient Stock</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Restock suggestions & supplier alerts</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">Better Patient Care</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Written-dose review & pharmacist approval</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Key Features
            </h2>
            <p className="text-base text-slate-600 mt-2">
              Everything you need to run a modern pharmacy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="bg-slate-50/80 hover:bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-blue-300 shadow-sm hover:shadow-lg transition-all group"
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feat.color} group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base mb-2 group-hover:text-blue-600 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Platform Showcase */}
      <section className="py-20 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Points */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Next-Gen Pharmacy Tech</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                Powered by AI for Smarter Pharmacy Decisions
              </h2>

              <ul className="space-y-4 pt-2">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="text-slate-200 text-sm font-medium">
                    Review demand trends and restock suggestions
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="text-slate-200 text-sm font-medium">
                    Alert medicines to restock
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="text-slate-200 text-sm font-medium">
                    Highlight items expiring within 12, 6 or 3 months
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="text-slate-200 text-sm font-medium">
                    Analyze business performance and growth opportunities
                  </span>
                </li>
              </ul>

              <div className="pt-4">
                <button
                  onClick={onOpenDashboard}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm"
                >
                  Explore AI Analytics <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Laptop Display Image */}
            <div className="lg:col-span-7">
              <div className="relative mx-auto rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700/60 bg-slate-800">
                <img
                  src={laptopdashboardImg}
                  alt="Swahivo Dashboard in Laptop"
                  width={900}
                  height={560}
                  className="w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built for Your Entire Pharmacy Ecosystem */}
      <section id="ecosystem" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Built for Your Entire Pharmacy Ecosystem
            </h2>
            <p className="text-base text-slate-600 mt-2">
              A unified platform for all players in the pharmaceutical supply chain.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
            {roles.map((role, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 text-center border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col items-center group"
              >
                <div className="relative w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-blue-100 group-hover:border-blue-500 transition-colors shadow-sm">
                  <img
                    src={role.img}
                    alt={role.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h4 className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">
                  {role.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-3">
                  {role.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscription Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Simple & Flexible Subscription Plans
            </h2>
            <p className="text-base text-slate-600 mt-2">
              Choose a plan that fits your pharmacy size and unlock more AI features.
            </p>

            {/* Toggle Monthly / Annual */}
            <div className="inline-flex items-center gap-3 p-1.5 bg-slate-100 rounded-full mt-6 border border-slate-200">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  billingCycle === 'annual'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Yearly</span>
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  2 months free
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 items-stretch">
            {plans.map((plan) => {
              const isPopular = plan.slug === 'professional';
              const isCustom = plan.price_tzs_monthly === 0 && plan.price_tzs_annual === 0;
              const yearly = yearlyPrice(plan);
              const original = plan.price_tzs_monthly * 12;
              const savedMonths = plan.price_tzs_monthly ? Math.round((original - yearly) / plan.price_tzs_monthly) : 0;
              const blurb: Record<string, string> = {
                starter: 'Best for a single outlet (ADDO or cosmetic shop)',
                growth: 'Best for retail only pharmacy',
                professional: 'Best for wholesale and retail pharmacy',
                network: 'Best for multi-branch pharmacies with up to 6 pharmacies',
                enterprise: 'For pharmacy chains & hospitals',
              };

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 flex flex-col bg-white relative transition-all ${
                    isPopular
                      ? 'border-2 border-blue-600 shadow-xl'
                      : 'border border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}
                  <div className="text-center">
                    <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {TRIAL_DAYS}-Day Free Trial
                    </span>
                    <h3 className="font-extrabold text-lg text-slate-900 uppercase mt-3">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{blurb[plan.slug] ?? ''}</p>
                    <div className="mt-4 mb-5 min-h-[96px]">
                      {isCustom ? (
                        <>
                          <div className="text-xs text-slate-500">Custom pricing</div>
                          <div className="text-2xl font-black text-blue-600 mt-1">Contact Sales</div>
                        </>
                      ) : billingCycle === 'monthly' ? (
                        <>
                          <div className="text-xs text-slate-500">Est. for monthly</div>
                          <div className="text-2xl font-black text-blue-600 mt-1">TZS {formatNumber(plan.price_tzs_monthly)}/=</div>
                          <div className="text-xs text-slate-600 mt-1">per month</div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs text-slate-500">Est. for yearly</div>
                          <div className="text-2xl font-black text-blue-600 mt-1">TZS {formatNumber(yearly)}/=</div>
                          {savedMonths > 0 && (
                            <span className="inline-block mt-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                              {savedMonths} {savedMonths === 1 ? 'month' : 'months'} free
                            </span>
                          )}
                          <div className="text-xs text-slate-600 mt-1">
                            <span className="line-through text-slate-400">TZS {formatNumber(original)}</span> · per year
                          </div>
                          <div className="text-[11px] text-emerald-600 font-semibold">You save TZS {formatNumber(original - yearly)}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-center">
                    <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Covlo AI tokens</div>
                    <div className="text-sm font-black text-slate-900">
                      {plan.ai_tokens_monthly == null ? 'Unlimited' : `${formatTokens(plan.ai_tokens_monthly)} / month`}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {plan.has_ai_insights ? 'For Covlo chat, scans, reports & AI tools in your plan' : 'For AI tools in your plan · Covlo chat from Retail Plus'}
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">What's included</div>
                  <div className="space-y-2 flex-1">
                    {[
                      ...plan.features,
                      ...(plan.has_ai_insights ? ['Covlo AI assistant & AI email reports'] : []),
                      ...(plan.has_prescription_stt_ttt ? ['AI Prescription Assistant (scan, type or speak)'] : []),
                      ...(plan.has_bulk_import_ocr ? ['AI invoice scanning & import matching'] : []),
                      ...(plan.has_advanced_ai_forecasting ? ['AI demand forecasting'] : []),
                      ...(plan.has_delivery_management ? ['Delivery management'] : []),
                      'Pay monthly or yearly',
                    ].map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-700">
                        <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 stroke-[2.5]" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => (isCustom ? (window.location.href = `mailto:${BRAND.enterpriseEmail}?subject=Enterprise%20Elite%20enquiry`) : onChoosePlan(plan.slug))}
                    className="mt-6 w-full py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                  >
                    {isCustom ? 'Request Enterprise Trial' : 'Start Free Trial'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-slate-500 mt-6">
            Every plan starts with a {TRIAL_DAYS}-day free trial, then pay monthly or yearly. Paying early ends the trial and starts your paid period. AI tokens reset on the 1st of each month.
          </p>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-2 text-center md:text-left">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Ready to Transform Your Pharmacy?
              </h2>
              <p className="text-blue-100 text-sm max-w-xl">
                Join hundreds of pharmacies using Swahivo to save time, reduce loss and
                grow their business.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full md:w-auto shrink-0">
              <Button onClick={isSignedIn ? onOpenDashboard : onSignIn} variant="secondary" className="h-12 min-w-0 px-2 sm:px-4 text-xs sm:text-sm font-bold">
                {isSignedIn ? 'Dashboard' : 'Get Started Free'} <ArrowRight />
              </Button>
              <Button onClick={goContact} variant="outline" className="hero-secondary-action h-12 min-w-0 px-2 sm:px-4 text-xs sm:text-sm font-bold">
                <PhoneCall /> Talk to Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      <ContactSection />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
            <div className="col-span-2">
              <img src={BRAND.logoUrl} alt="Afyadawa" className="h-10 w-auto mb-3 bg-white rounded-full px-1" />
              <p className="text-slate-400 text-xs max-w-sm mb-4">
                The premier digital pharmacy operating system in East Africa and across the globe.
                Multi-branch POS, AI inventory forecasting, and real-time supply chain integration.
              </p>
              <div className="text-[11px] text-slate-500">
                Connected to a secure cloud database & AI assistant.
              </div>
              <div className="mt-4 space-y-1 text-slate-300">
                <div className="text-white font-bold uppercase tracking-wider text-[11px]">Contact us</div>
                <a href={`mailto:${BRAND.email}`} className="block hover:text-white">{BRAND.email}</a>
                {BRAND.phones.map((p) => (
                  <a key={p} href={telHref(p)} className="block hover:text-white">{p}</a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">
                Product
              </h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white">POS & Cashier</a></li>
                <li><a href="#features" className="hover:text-white">Smart Inventory</a></li>
                <li><a href="#features" className="hover:text-white">Prescription AI (STT/TTT)</a></li>
                <li><a href="#features" className="hover:text-white">Delivery Management</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">
                Solutions
              </h4>
              <ul className="space-y-2">
                <li><a href="#ecosystem" className="hover:text-white">Single Pharmacy</a></li>
                <li><a href="#ecosystem" className="hover:text-white">Pharmacy Chains</a></li>
                <li><a href="#ecosystem" className="hover:text-white">Wholesalers & Suppliers</a></li>
                <li><a href="#ecosystem" className="hover:text-white">Hospitals & Clinics</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#pricing" className="hover:text-white">Subscription Plans</a></li>
                <li><a href="#contact" className="hover:text-white">Help & Support</a></li>
                <li><a href="#contact" className="hover:text-white">Contact Sales</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
            <div>© 2026 Swahivo. All rights reserved.</div>
            <div className="flex items-center gap-6">
              <a href="#privacy" className="hover:text-white">Privacy Policy</a>
              <a href="#terms" className="hover:text-white">Terms of Service</a>
              <a href="#security" className="hover:text-white">HIPAA & Pharmacy Data Security</a>
            </div>
          </div>
        </div>
      </footer>
      <VisitorChat />
    </div>
  );
}
