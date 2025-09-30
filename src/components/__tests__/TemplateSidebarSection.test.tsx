import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuildingProvider, useBuildingState } from '../../context/BuildingProvider';
import { TemplateSidebarSection } from '../sidebar/TemplateSidebarSection';

const TemplateIndicator = () => {
  const { state } = useBuildingState();
  return <div data-testid="active-template">{state.template}</div>;
};

describe('TemplateSidebarSection', () => {
  it('is collapsed by default and toggles open to show template options', async () => {
    const user = userEvent.setup();
    render(
      <BuildingProvider initialTemplate="rectangle">
        <TemplateSidebarSection />
        <TemplateIndicator />
      </BuildingProvider>
    );

    const indicator = screen.getByTestId('active-template');
    expect(indicator).toHaveTextContent('rectangle');
    expect(screen.queryByRole('button', { name: /L字型/ })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /テンプレート一覧/ });
    await user.click(toggle);

    const list = screen.getByTestId('template-list');
    expect(within(list).getByRole('button', { name: /L字型/ })).toBeInTheDocument();
  });

  it('applies a template when selecting an option', async () => {
    const user = userEvent.setup();
    render(
      <BuildingProvider initialTemplate="rectangle">
        <TemplateSidebarSection />
        <TemplateIndicator />
      </BuildingProvider>
    );

    await user.click(screen.getByRole('button', { name: /テンプレート一覧/ }));
    const lShape = screen.getByRole('button', { name: /L字型/ });
    await user.click(lShape);

    expect(screen.getByTestId('active-template')).toHaveTextContent('l-shape');
  });
});
