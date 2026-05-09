/* eslint-disable react-refresh/only-export-components */
import { useMemo } from "react";
import { resolveApiAssetUrl } from "./resolveUrl";

const categoryColorClasses = [
  "from-indigo-100 via-indigo-50 to-white",
  "from-purple-100 via-fuchsia-50 to-white",
  "from-slate-100 via-gray-50 to-white",
  "from-violet-100 via-purple-50 to-white",
  "from-stone-100 via-zinc-50 to-white",
  "from-blue-100 via-indigo-50 to-white",
  "from-neutral-100 via-gray-50 to-white",
  "from-lavender-100 via-violet-50 to-white",
];

const categoryIconBgClasses = [
  "from-indigo-100 to-purple-100",
  "from-slate-100 to-slate-200",
  "from-violet-100 to-fuchsia-100",
  "from-blue-100 to-indigo-100",
  "from-gray-100 to-zinc-100",
  "from-purple-100 to-violet-100",
  "from-stone-100 to-neutral-100",
  "from-indigo-50 to-purple-100",
];

function IconDevice() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M9 4.75A1.75 1.75 0 0 1 10.75 3h2.5A1.75 1.75 0 0 1 15 4.75v10.5A1.75 1.75 0 0 1 13.25 17h-2.5A1.75 1.75 0 0 1 9 15.25Z M11 5h2v9h-2Z M11.75 14.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" fill="currentColor" />
    </svg>
  );
}

function IconLaptop() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M6.75 5A1.75 1.75 0 0 0 5 6.75v5.5h10v-5.5A1.75 1.75 0 0 0 13.25 5Zm-.25 7.75H3.75a.75.75 0 0 0-.7 1.02l.4 1A1.75 1.75 0 0 0 5.08 16h9.84a1.75 1.75 0 0 0 1.63-1.23l.4-1a.75.75 0 0 0-.7-1.02H6.5Z" fill="currentColor" />
    </svg>
  );
}

function IconShirt() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M8.4 4.2a2.25 2.25 0 0 0 3.2 0l.28-.28 2.36 1.18a1.75 1.75 0 0 1 .97 1.57V9l-2-.8V17H7V8.2L5 9V6.67a1.75 1.75 0 0 1 .97-1.57l2.35-1.18Z" fill="currentColor" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M4 5.75A.75.75 0 0 1 4.75 5H6l.35 1.75h8.43a.75.75 0 0 1 .74.9l-1 5A.75.75 0 0 1 13.8 13H7.05a.75.75 0 0 1-.74-.6L5.1 6.25H4.75A.75.75 0 0 1 4 5.75ZM8 16a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M10.54 3.36a1 1 0 0 0-1.08 0l-5.5 3.67A1 1 0 0 0 3.5 7.9V15a2 2 0 0 0 2 2H8v-4h4v4h2.5a2 2 0 0 0 2-2V7.9a1 1 0 0 0-.46-.83Z" fill="currentColor" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="m10 3 .9 2.6L13.5 6.5l-2.6.9L10 10l-.9-2.6-2.6-.9 2.6-.9Zm4 7 .55 1.45L16 12l-1.45.55L14 14l-.55-1.45L12 12l1.45-.55ZM6 11l.7 1.8L8.5 13l-1.8.7L6 15.5l-.7-1.8L3.5 13l1.8-.7Z" fill="currentColor" />
    </svg>
  );
}

function IconBall() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M10 4a6 6 0 1 0 0 12A6 6 0 0 0 10 4Zm0 2 1.3.95-.5 1.55H9.2l-.5-1.55Zm-2.95 2.1 1.4-.1.9 1.2-.55 1.65-1.45.45-1.15-1.1Zm5.9 0 1.45 2.1-1.15 1.1-1.45-.45-.55-1.65.9-1.2Zm-3.8 4.2h1.7l.95 1.25-.8 1.45H8.98l-.78-1.45Z" fill="currentColor" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M6.75 4A2.75 2.75 0 0 0 4 6.75v6.5A2.75 2.75 0 0 0 6.75 16H15a1 1 0 1 0 0-2H6.75A.75.75 0 0 1 6 13.25v-.1c.24.1.5.15.75.15H15V5.75A1.75 1.75 0 0 0 13.25 4Z" fill="currentColor" />
    </svg>
  );
}

const iconList = [IconDevice, IconLaptop, IconShirt, IconCart, IconHome, IconSparkle, IconBall, IconBook];

function getHashIndex(value, size) {
  const normalized = String(value || "").trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return size > 0 ? hash % size : 0;
}

export function getCategoryColor(category) {
  return categoryColorClasses[getHashIndex(category?.slug || category?.name, categoryColorClasses.length)];
}

export function getCategoryIconBackground(category) {
  return categoryIconBgClasses[getHashIndex(category?.slug || category?.name, categoryIconBgClasses.length)];
}

export function getCategoryIconComponent(category) {
  // If category has a logo, use it as an image instead of icon
  if (category?.logo?.trim()) {
    const logoUrl = category.logo.startsWith("data:") 
      ? category.logo 
      : resolveApiAssetUrl(category.logo);
    
    return function LogoIcon() {
      return (
        <img 
          src={logoUrl} 
          alt={category.name} 
          className="h-full w-full rounded-lg object-cover"
          loading="lazy"
        />
      );
    };
  }

  if (category?.icon?.trim()) {
    return function StoredIcon() {
      return <span aria-hidden="true">{category.icon.trim()}</span>;
    };
  }

  return iconList[getHashIndex(category?.slug || category?.name, iconList.length)];
}

export function usePresentedCategories(categories) {
  return useMemo(
    () =>
      (Array.isArray(categories) ? categories : []).map((category) => ({
        ...category,
        id: category._id || category.id || category.slug || category.name,
        color: getCategoryColor(category),
        iconBg: getCategoryIconBackground(category),
        IconComponent: getCategoryIconComponent(category),
      })),
    [categories]
  );
}
