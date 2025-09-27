"use client";

import { BuildingProvider } from '../context/BuildingProvider';
import { EditorLayout } from '../components/EditorLayout';

export default function HomePage() {
  return (
    <BuildingProvider initialTemplate="rectangle">
      <EditorLayout />
    </BuildingProvider>
  );
}
