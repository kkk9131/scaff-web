import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuildingProvider } from '../../context/BuildingProvider';
import { PlanViewCanvas } from '../PlanViewCanvas';
import { TemplateSidebarSection } from '../sidebar/TemplateSidebarSection';
import { RoofSidebarSection } from '../sidebar/RoofSidebarSection';
import { DrawingSupportToolbar } from '../DrawingSupportToolbar';
import { DimensionPanel } from '../DimensionPanel';
import { ElevationViews } from '../ElevationViews';
import { ThreeDView } from '../ThreeDView';
import { OutputToolbar } from '../OutputToolbar';

type KonvaEvent = { target: { x: () => number; y: () => number } };

jest.mock('react-konva', () => {
  const React = require('react');
  return {
    Stage: ({ children, width, height, ...props }: any) => (
      <div data-testid="plan-stage" data-width={width} data-height={height} {...props}>
        {children}
      </div>
    ),
    Layer: ({ children, ...props }: any) => (
      <div data-testid="plan-layer" {...props}>
        {children}
      </div>
    ),
    Line: ({ points, stroke, dash, closed: _closed, listening: _listening, lineCap: _lineCap, lineJoin: _lineJoin, ...props }: any) => {
      const testId = props['data-testid'] ?? 'plan-floor-line';
      const rest = { ...props };
      delete rest['data-testid'];
      return (
        <div
          data-testid={testId}
          data-points={points.join(',')}
          data-stroke={stroke}
          data-dash={dash ? dash.join(',') : ''}
          {...rest}
        />
      );
    },
    Circle: ({ onDragEnd, onMouseEnter, onMouseLeave, x, y, ...props }: any) => {
      const stage = {
        getPointerPosition: () => ({ x: (x ?? 0) + 20, y: (y ?? 0) + 10 }),
        container: () => ({ style: {} })
      };
      const target = {
        x: () => (x ?? 0) + 20,
        y: () => (y ?? 0) + 10,
        getStage: () => stage
      };
      const event = { target } as KonvaEvent & { target: typeof target };
      return (
        <button
          type="button"
          data-testid={props['data-testid']}
          onClick={() => onDragEnd?.(event)}
          onMouseEnter={() => onMouseEnter?.({ target })}
          onMouseLeave={() => onMouseLeave?.({ target })}
          {...props}
        >
          vertex
        </button>
      );
    },
    Text: ({ text, listening: _listening, offsetX: _offsetX, offsetY: _offsetY, ...props }: any) => (
      <span data-testid="plan-text" {...props}>
        {text}
      </span>
    )
  };
});

jest.mock('@react-three/fiber', () => {
  const React = require('react');
  return {
    Canvas: ({ children, ...props }: any) => (
      <div data-testid="three-canvas" {...props}>
        {children}
      </div>
    ),
    ambientLight: (props: any) => <span data-testid="ambient-light" {...props} />
  };
});

jest.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  PerspectiveCamera: ({ children }: any) => <>{children}</>,
  Line: (props: any) => <div data-testid="three-line" data-points={JSON.stringify(props.points)} />
}));

const addImageMock = jest.fn();
const saveMock = jest.fn();

jest.mock('html-to-image', () => ({
  toSvg: jest.fn().mockResolvedValue('<svg></svg>'),
  toJpeg: jest.fn().mockResolvedValue('data:image/jpeg;base64,AAA')
}));

jest.mock('jspdf', () => ({
  jsPDF: function MockJsPDF() {
    return {
      addImage: addImageMock,
      save: saveMock
    };
  }
}));

const getPlanPolygonLine = () => {
  const lines = screen.getAllByTestId('plan-floor-line');
  return lines.find((line) => line.getAttribute('data-stroke') === '#2563eb');
};

describe('Editor views integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  const renderEditor = () =>
    render(
      <BuildingProvider initialTemplate="rectangle">
      <div>
        <TemplateSidebarSection />
        <RoofSidebarSection />
        <DrawingSupportToolbar />
        <PlanViewCanvas />
        <DimensionPanel />
        <ElevationViews />
        <ThreeDView />
        <OutputToolbar />
      </div>
    </BuildingProvider>
  );

  it('syncs plan, dimension, elevation, and 3D data when updating dimensions', async () => {
    const user = userEvent.setup();
    renderEditor();

    const polygonLine = getPlanPolygonLine();
    expect(polygonLine).toBeTruthy();
    const north = screen.getByTestId('elevation-north');
    expect(north).toHaveTextContent('|──6000──|');

    const lengthInput = screen.getByLabelText('Edge 1 Length (mm)');
    await user.clear(lengthInput);
    await user.type(lengthInput, '7000');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('elevation-north')).toHaveTextContent('|──7000──|');
    });

    const threeSummary = screen.getByTestId('three-summary');
    expect(threeSummary).toHaveTextContent('floor-1');
    expect(threeSummary.textContent ?? '').toContain('3000mm');
  });

  it('toggles drawing support modes and generates eaves', async () => {
    const user = userEvent.setup();
    renderEditor();

    const initialGrid = document.querySelectorAll('[data-testid="plan-grid-line"]').length;
    expect(initialGrid).toBeGreaterThan(0);

    const gridToggle = screen.getByRole('button', { name: 'グリッド表示' });
    await user.click(gridToggle);

    await waitFor(() => {
      const gridCount = document.querySelectorAll('[data-testid="plan-grid-line"]').length;
      expect(gridCount).toBe(0);
    });

    const eaveButton = screen.getByRole('button', { name: '軒の出500mm' });
    await user.click(eaveButton);
    await waitFor(() => {
      const eaveLines = document.querySelectorAll('[data-testid="plan-eave-line"]').length;
      expect(eaveLines).toBeGreaterThan(0);
    });
    await waitFor(() => {
      const eaveDimensionLines = document.querySelectorAll('[data-testid="plan-dimension-line-eave"]').length;
      expect(eaveDimensionLines).toBeGreaterThan(0);
    });

    await waitFor(() => {
      const elevationEaveLines = screen.getAllByTestId('elevation-eave-line');
      expect(elevationEaveLines.length).toBeGreaterThan(0);
    });

    expect(screen.getAllByTestId('elevation-roof-outline').length).toBeGreaterThan(0);

    const eaveLine = document.querySelector('[data-testid="plan-eave-line"]');
    expect(eaveLine?.getAttribute('data-stroke')).toBe('#2563eb');

    const lockButton = screen.getByRole('button', { name: /編集ロック/ });
    await user.click(lockButton);
    expect(screen.getByRole('button', { name: /編集ロック解除/ })).toBeInTheDocument();

    const dimensionToggle = screen.getByRole('button', { name: '寸法表示' });
    const dimensionLinesInitial = document.querySelectorAll('[data-testid="plan-dimension-line-segment"]').length;
    expect(dimensionLinesInitial).toBe(0);
    const totalLinesInitial = document.querySelectorAll('[data-testid="plan-dimension-line-total"]').length;
    expect(totalLinesInitial).toBe(4);
    const eaveLinesInitial = document.querySelectorAll('[data-testid="plan-dimension-line-eave"]').length;

    await user.click(dimensionToggle);
    await waitFor(() => {
      const dimensionLines = document.querySelectorAll('[data-testid="plan-dimension-line-segment"]').length;
      expect(dimensionLines).toBe(0);
      const totalLines = document.querySelectorAll('[data-testid="plan-dimension-line-total"]').length;
      expect(totalLines).toBe(0);
      const eaveLines = document.querySelectorAll('[data-testid="plan-dimension-line-eave"]').length;
      expect(eaveLines).toBe(0);
    });

    await user.click(dimensionToggle);
    await waitFor(() => {
      const dimensionLines = document.querySelectorAll('[data-testid="plan-dimension-line-segment"]').length;
      expect(dimensionLines).toBe(0);
      const totalLines = document.querySelectorAll('[data-testid="plan-dimension-line-total"]').length;
      expect(totalLines).toBe(4);
      const eaveLines = document.querySelectorAll('[data-testid="plan-dimension-line-eave"]').length;
      expect(eaveLines).toBe(eaveLinesInitial);
    });
  });

  it('toggles elevation dimension visibility through roof controls', async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getAllByTestId('elevation-dimensions').length).toBeGreaterThan(0);

    const toggleButton = screen.getByRole('button', { name: '立面寸法表示' });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.queryAllByTestId('elevation-dimensions').length).toBe(0);
    });
  });

  it('updates gable elevation outlines when changing orientation', async () => {
    const user = userEvent.setup();
    renderEditor();

    const gableButton = screen.getByRole('button', { name: /切妻/ });
    await user.click(gableButton);

    const northElevation = within(screen.getByTestId('elevation-north')).getByRole('img');
    const eastElevation = within(screen.getByTestId('elevation-east')).getByRole('img');

    const eaveButton = screen.getByRole('button', { name: '軒の出500mm' });
    await user.click(eaveButton);

    await waitFor(() => {
      const lines = within(screen.getByTestId('elevation-north')).queryAllByTestId('elevation-eave-line');
      expect(lines.length).toBeGreaterThan(0);
    });

    const slopeInput = screen.getByLabelText('勾配') as HTMLInputElement;
    await user.clear(slopeInput);
    await user.type(slopeInput, '5');
    await user.tab();

    await waitFor(() => {
      const eaveLines = within(screen.getByTestId('elevation-north')).getAllByTestId('elevation-eave-line');
      const allHorizontalNorth = eaveLines.every((line) => {
        const y1 = Number(line.getAttribute('y1'));
        const y2 = Number(line.getAttribute('y2'));
        return Number.isFinite(y1) && Number.isFinite(y2) && Math.abs(y2 - y1) < 0.5;
      });
      expect(allHorizontalNorth).toBe(true);
    });

    await waitFor(() => {
      const eastEaveLines = within(screen.getByTestId('elevation-east')).getAllByTestId('elevation-eave-line');
      const allHorizontal = eastEaveLines.every((line) => {
        const y1 = Number(line.getAttribute('y1'));
        const y2 = Number(line.getAttribute('y2'));
        return Number.isFinite(y1) && Number.isFinite(y2) && Math.abs(y2 - y1) < 0.5;
      });
      expect(allHorizontal).toBe(true);
    });

    const countPoints = (polyline: Element | null) => {
      const points = polyline?.getAttribute('points');
      if (!points) {
        return 0;
      }
      return points
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    };

    const northPolylineInitial = northElevation.querySelector('polyline');
    expect(countPoints(northPolylineInitial)).toBeGreaterThan(5);

    const eastWestButton = screen.getByRole('button', { name: /東・西/ });
    await user.click(eastWestButton);

    await waitFor(() => {
      const northPolylineUpdated = northElevation.querySelector('polyline');
      expect(countPoints(northPolylineUpdated)).toBeLessThanOrEqual(5);
    });

    await waitFor(() => {
      const eastPolylineUpdated = eastElevation.querySelector('polyline');
      expect(countPoints(eastPolylineUpdated)).toBeGreaterThan(5);
    });
  });

  it('renders hip roof ridge and apex based on slope or highest height', async () => {
    const user = userEvent.setup();
    renderEditor();

    const hipButton = screen.getByRole('button', { name: /寄棟/ });
    await user.click(hipButton);

    const eaveInput = screen.getByLabelText('軒の出') as HTMLInputElement;
    await user.clear(eaveInput);
    await user.type(eaveInput, '600');
    await user.tab();

    const northElevation = within(screen.getByTestId('elevation-north')).getByRole('img');
    const eastElevation = within(screen.getByTestId('elevation-east')).getByRole('img');

    await waitFor(() => {
      expect(within(screen.getByTestId('elevation-north')).getAllByTestId('elevation-eave-line').length).toBeGreaterThan(0);
    });

    const readRidgeY = () => {
      const lines = Array.from(northElevation.querySelectorAll('line'));
      for (const line of lines) {
        if (!line.getAttribute('stroke-dasharray')) {
          continue;
        }
        const x1 = Number(line.getAttribute('x1'));
        const x2 = Number(line.getAttribute('x2'));
        const y1 = Number(line.getAttribute('y1'));
        const y2 = Number(line.getAttribute('y2'));
        if ([x1, x2, y1, y2].some((value) => Number.isNaN(value))) {
          continue;
        }
        if (Math.abs(y1 - y2) < 0.5 && Math.abs(x1 - x2) > 5) {
          return y1;
        }
      }
      return null;
    };

    let initialRidgeY: number | null = null;
    await waitFor(() => {
      initialRidgeY = readRidgeY();
      expect(initialRidgeY).not.toBeNull();
    });

    const slopeInput = screen.getByLabelText('勾配') as HTMLInputElement;
    await user.clear(slopeInput);
    await user.type(slopeInput, '5');
    await user.tab();

    await waitFor(() => {
      const updatedRidgeY = readRidgeY();
      expect(updatedRidgeY).not.toBeNull();
      expect(initialRidgeY).not.toBeNull();
      if (updatedRidgeY && initialRidgeY) {
        expect(updatedRidgeY).toBeLessThan(initialRidgeY);
      }
    });

    await waitFor(() => {
      const dashed = Array.from(eastElevation.querySelectorAll('line')).filter((line) => line.getAttribute('stroke-dasharray'));
      const hasHorizontal = dashed.some((line) => {
        const y1 = Number(line.getAttribute('y1'));
        const y2 = Number(line.getAttribute('y2'));
        const x1 = Number(line.getAttribute('x1'));
        const x2 = Number(line.getAttribute('x2'));
        if ([x1, x2, y1, y2].some((value) => Number.isNaN(value))) {
          return false;
        }
        return Math.abs(y1 - y2) < 0.5 && Math.abs(x1 - x2) > 5;
      });
      expect(hasHorizontal).toBe(true);
    });

    await waitFor(() => {
      const eastEaves = within(screen.getByTestId('elevation-east')).getAllByTestId('elevation-eave-line');
      expect(eastEaves.length).toBeGreaterThan(0);
    });
  });

  it('shows dimension lines only for the active floor when multiple floors exist', async () => {
    const user = userEvent.setup();
    renderEditor();

    const getTotalLines = () => document.querySelectorAll('[data-testid="plan-dimension-line-total"]').length;

    await waitFor(() => {
      expect(getTotalLines()).toBeGreaterThan(0);
    });
    const initialTotalLines = getTotalLines();

    const addFloorButton = screen.getByRole('button', { name: 'Add Floor' });
    await user.click(addFloorButton);

    await waitFor(() => {
      const selector = screen.getByLabelText('Floor selector') as HTMLSelectElement;
      expect(selector.value).toBe('floor-2');
    });

    await waitFor(() => {
      expect(getTotalLines()).toBe(initialTotalLines);
    });

    const floorSelector = screen.getByLabelText('Floor selector') as HTMLSelectElement;
    await user.selectOptions(floorSelector, 'floor-1');

    await waitFor(() => {
      expect(floorSelector.value).toBe('floor-1');
    });

    await waitFor(() => {
      expect(getTotalLines()).toBe(initialTotalLines);
    });
  });

  it('highlights selected edge and supports vertex editing', async () => {
    const user = userEvent.setup();
    renderEditor();

    const edgeButton = await screen.findByRole('button', { name: /Edge 1/ });
    await user.click(edgeButton);

    const vertex = screen.getByTestId('plan-vertex-0');
    expect(vertex.getAttribute('fill')).toBe('#f97316');

    const addButtons = screen.getAllByText('頂点を追加');
    const removeButtons = screen.getAllByText('頂点を削除');
    const vertexCountBefore = document.querySelectorAll('[data-testid^="plan-vertex-"]').length;

    await user.click(addButtons[0]);

    await waitFor(() => {
      const vertexCountAfter = document.querySelectorAll('[data-testid^="plan-vertex-"]').length;
      expect(vertexCountAfter).toBeGreaterThan(vertexCountBefore);
    });

    const vertexCountAfterAdd = document.querySelectorAll('[data-testid^="plan-vertex-"]').length;
    await user.click(removeButtons[0]);
    await waitFor(() => {
      const vertexCountAfterRemove = document.querySelectorAll('[data-testid^="plan-vertex-"]').length;
      expect(vertexCountAfterRemove).toBeLessThanOrEqual(vertexCountAfterAdd);
    });
  });

  it('switches template when selecting concave option', async () => {
    const user = userEvent.setup();
    renderEditor();

    const line = getPlanPolygonLine();
    if (!line) {
      throw new Error('Polygon line not found');
    }
    const beforePoints = line.getAttribute('data-points');
    await user.click(screen.getByRole('button', { name: /テンプレート一覧/ }));
    const concaveButton = await screen.findByRole('button', { name: /凹型/ });
    await user.click(concaveButton);

    await waitFor(() => {
      const afterLine = getPlanPolygonLine();
      expect(afterLine).toBeTruthy();
      const afterPoints = afterLine?.getAttribute('data-points');
      expect(afterPoints).not.toBe(beforePoints);
      const coordinates = afterPoints?.split(',') ?? [];
      expect(coordinates.length).toBeGreaterThan(8);
    });
  });

  it('updates plan data when a vertex is dragged', async () => {
    const user = userEvent.setup();
    renderEditor();

    const line = getPlanPolygonLine();
    if (!line) {
      throw new Error('Polygon line not found');
    }
    const beforePoints = line.getAttribute('data-points');
    const vertexButton = screen.getByTestId('plan-vertex-0');
    await user.click(vertexButton);

    await waitFor(() => {
      const afterLine = getPlanPolygonLine();
      expect(afterLine).toBeTruthy();
      const afterPoints = afterLine?.getAttribute('data-points');
      expect(afterPoints).not.toBe(beforePoints);
    });
  });

  it('shows validation errors for invalid floor height input', async () => {
    const user = userEvent.setup();
    renderEditor();

    const heightInput = screen.getByLabelText('Floor Height (mm)');
    await user.clear(heightInput);
    await user.type(heightInput, '-100');
    await user.tab();

    const alerts = screen.getAllByRole('alert');
    const inlineAlert = alerts.find((node) => within(node).queryByText(/0より大きい/));
    expect(inlineAlert).toBeTruthy();
    expect(screen.getByTestId('elevation-north')).toHaveTextContent('|──6000──|');
  });

  it('provides export feedback in the output toolbar', async () => {
    const user = userEvent.setup();
    renderEditor();

    const svgButton = screen.getByText('Export SVG');
    await user.click(svgButton);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('SVGをエクスポートしました。');
    });
  });
});
