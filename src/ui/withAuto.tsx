import { isDev } from '@alloc/is-dev'
import React, { forwardRef, ReactNode, Ref, RefAttributes } from 'react'
import { useLayoutEffect } from 'react-layout-effect'
import { Auto, AutoObserver } from '../auto'
import { batch } from '../batch'
import { addDebugAction, getDebug, setDebug } from '../debug'
import { global } from '../global'
import { AutoContext, useAutoContext } from './AutoContext'
import { RenderAction, useConstant, useDispose, useForceUpdate } from './common'

interface Component<P = any> {
  (props: P): ReactNode
  displayName?: string
}

interface RefForwardingComponent<T = any, P = any> {
  (props: P, ref: Ref<T>): ReactNode
  displayName?: string
}

type RefForwardingAuto<T extends RefForwardingComponent> = T &
  ((
    props: T extends RefForwardingComponent<infer U, infer P>
      ? P & RefAttributes<U>
      : never
  ) => ReactNode)

/** Wrap a component with magic observable tracking */
export function withAuto<T extends Component>(render: T): T

/** Wrap a component with `forwardRef` and magic observable tracking */
export function withAuto<T extends RefForwardingComponent>(
  render: T
): RefForwardingAuto<T>

/** @internal */
export function withAuto(render: any) {
  let component: React.FunctionComponent<any> = (props, ref) => {
    const { auto, depth, commit } = useAutoRender(component)

    // Subscribe to observables as early as possible, because
    // we don't want effects to trigger the previous observer.
    useLayoutEffect(() => commit(observer, nonce))

    // Track which observable state is used during render.
    const observer = auto.start(render)
    try {
      var content = render(props, ref)
    } finally {
      auto.stop()
    }

    // Cache the nonce for cancellation purposes.
    const { nonce } = observer

    // React might discard this render without telling us, but we can
    // detect that with our first child's render phase.
    const recon = (
      <RenderAction
        useAction={() => {
          auto.nonce = nonce
        }}
      />
    )

    return (
      <AutoContext depth={depth + 1}>
        {recon}
        {content}
      </AutoContext>
    )
  }
  if (render.length > 1) {
    // Bind its component name to the ref forwarder.
    Object.defineProperty(component, 'displayName', {
      get: () => component.displayName,
    })
    component = forwardRef(component)
  }
  return component
}

function useAutoRender(component: React.FunctionComponent<any>) {
  const { depth } = useAutoContext()

  const forceUpdate = useForceUpdate()
  const auto = useConstant(() => {
    const auto = new Auto({
      onDirty() {
        if (isDev) {
          addDebugAction(auto, 'dirty')
        }
        const { nonce } = auto
        batch.render(depth, () => {
          // Skip any update whose "component" was reconciled sometime
          // between when it became dirty and when the batch was flushed.
          if (nonce == auto.nonce) {
            if (isDev) {
              addDebugAction(auto, 'batch')
            }
            forceUpdate()
          }
        })
      },
    })
    if (isDev) {
      setDebug(auto, {
        name: component.displayName || 'Anonymous',
        actions: ['init'],
        renders: 0,
      })
    }
    return auto
  })

  if (isDev) {
    getDebug(auto).renders!++
    if (global.onRender) {
      global.onRender(auto, depth, component)
    }
  }

  useDispose(() => auto.dispose())
  return {
    auto,
    depth,
    commit(observer: AutoObserver, nonce: number) {
      if (isDev) {
        getDebug(auto).actions = []
      }
      if (!auto.commit(observer, nonce)) {
        if (isDev) {
          addDebugAction(auto, 'dirty')
        }
        forceUpdate()
      } else if (isDev) {
        addDebugAction(auto, 'observe')
      }
    },
  }
}
