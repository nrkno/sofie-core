import * as React from 'react'
import * as ClassNames from 'classnames'

interface IProps {
	className?: string
	accept?: string
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
	children?: React.ReactNode
}

export const UploadButton: React.SFC<IProps> = function(props: IProps) {
	return (
		<label className={props.className}>
			{props.children}
			<input
				type="file"
				accept={props.accept}
				onChange={props.onChange}
				style={{
					visibility: 'hidden',
					width: 0,
					height: 0,
					display: 'inline',
					position: 'absolute',
				}}
			/>
		</label>
	)
}
