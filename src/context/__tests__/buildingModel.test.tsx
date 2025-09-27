import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  BuildingProvider,
  createInitialBuildingModel,
  validateBuildingModel,
  useBuildingState
} from '../BuildingProvider';
import type { BuildingModel, FloorModel, TemplateType } from '../BuildingProvider';

describe('Building model initialization', () => {
  const template: TemplateType = 'rectangle';

  it('creates an initial building model for the given template', () => {
    const model = createInitialBuildingModel(template);

    expect(model.template).toBe(template);
    expect(model.floors).toHaveLength(1);

    const floor = model.floors[0];
    expect(floor.polygon).toHaveLength(4);
    expect(floor.dimensions).toHaveLength(4);
    expect(new Set(floor.dimensions.map((d) => d.edgeId)).size).toBe(4);
    expect(floor.height).toBeGreaterThan(0);
    expect(floor.roof.type).toBe('flat');
  });

  it('produces no validation errors for the default model', () => {
    const model = createInitialBuildingModel(template);
    const result = validateBuildingModel(model);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects invalid polygons and dimensions', () => {
    const invalidFloor: FloorModel = {
      id: 'floor-1',
      name: '1F',
      polygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 }
      ],
      dimensions: [
        { edgeId: 'edge-1', length: -10, offset: 0 },
        { edgeId: 'edge-2', length: 0, offset: 0 }
      ],
      height: 0,
      roof: { type: 'flat', slopeValue: 0 },
      style: {
        strokeColor: '#000000',
        roofStrokeColor: '#000000',
        strokeWidth: 1,
        roofDash: [4, 4]
      }
    };

    const invalidModel: BuildingModel = {
      template,
      activeFloorId: invalidFloor.id,
      floors: [invalidFloor],
      lastError: null
    };

    const result = validateBuildingModel(invalidModel);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('provides the initial state via BuildingProvider', () => {
    const Consumer = () => {
      const { state } = useBuildingState();
      return <span data-testid="active-floor">{state.activeFloorId}</span>;
    };

    render(
      <BuildingProvider initialTemplate={template}>
        <Consumer />
      </BuildingProvider>
    );

    const activeFloor = screen.getByTestId('active-floor');
    expect(activeFloor.textContent).toMatch(/floor/);
  });
});
